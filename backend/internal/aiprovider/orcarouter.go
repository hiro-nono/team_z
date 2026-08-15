// Package aiprovider はOrcaRouter(OpenAI互換Responses API)とのHTTP通信を閉じ込める。
// handler/usecaseは本パッケージのAnalyzePDFのみを呼び出し、リクエスト/レスポンスの形式や
// 認証ヘッダーの詳細を意識しない。
package aiprovider

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hiro-nono/team_z/backend/internal/model"
)

// requestTimeout はOrcaRouterへの1リクエストあたりのタイムアウト
const requestTimeout = 90 * time.Second

// maxResponseBodyBytes はOrcaRouterからのレスポンスボディを読み取る上限
// (Structured Outputで返るJSONは小さいため、これを超える場合は異常なレスポンスとして扱う)
const maxResponseBodyBytes = 5 * 1024 * 1024

const responsesPath = "/responses"

var (
	// ErrNotConfigured はAPIキーがサーバーに設定されていない場合のエラー
	ErrNotConfigured = errors.New("orcarouter is not configured")
	// ErrTimeout はOrcaRouterへのリクエストがタイムアウトした場合のエラー
	ErrTimeout = errors.New("orcarouter request timed out")
	// ErrConnection はOrcaRouterへ接続できなかった場合のエラー
	ErrConnection = errors.New("failed to connect to orcarouter")
	// ErrUpstream はOrcaRouterがエラーレスポンスまたは不正なレスポンスを返した場合のエラー
	ErrUpstream = errors.New("orcarouter returned an error")
)

// OrcaRouterClient はOrcaRouterのOpenAI互換Responses APIを呼び出し、PDFを解析させる
type OrcaRouterClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewOrcaRouterClient(baseURL, apiKey, model string) *OrcaRouterClient {
	return &OrcaRouterClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		model:      model,
		httpClient: http.DefaultClient,
	}
}

type responsesRequest struct {
	Model string             `json:"model"`
	Input []responsesMessage `json:"input"`
	Text  responsesText      `json:"text"`
}

type responsesMessage struct {
	Role    string                 `json:"role"`
	Content []responsesContentPart `json:"content"`
}

type responsesContentPart struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	FileName string `json:"filename,omitempty"`
	FileData string `json:"file_data,omitempty"`
}

type responsesText struct {
	Format responsesJSONSchemaFormat `json:"format"`
}

type responsesJSONSchemaFormat struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Strict bool   `json:"strict"`
	Schema any    `json:"schema"`
}

type responsesResponse struct {
	OutputText string                `json:"output_text"`
	Output     []responsesOutputItem `json:"output"`
}

type responsesOutputItem struct {
	Content []responsesOutputContent `json:"content"`
}

type responsesOutputContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// AnalyzePDF はPDFのバイト列をOrcaRouterのResponses APIへ送信し、
// Structured Outputとして返された出力テキスト(JSON文字列)を返す。
// 出力テキストが空の場合は空文字列とnilエラーを返す(呼び出し側で判断させる)。
func (c *OrcaRouterClient) AnalyzePDF(ctx context.Context, fileName string, pdfBytes []byte) (string, error) {
	if c.apiKey == "" {
		return "", ErrNotConfigured
	}

	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	safeFileName := fileName
	if safeFileName == "" {
		safeFileName = "notice.pdf"
	}

	reqBody := responsesRequest{
		Model: c.model,
		Input: []responsesMessage{
			{
				Role:    "system",
				Content: []responsesContentPart{{Type: "input_text", Text: model.SchoolNoticeSystemPrompt}},
			},
			{
				Role: "user",
				Content: []responsesContentPart{
					{Type: "input_text", Text: fmt.Sprintf("ファイル名: %s\nこのPDFを解析してください。", safeFileName)},
					{
						Type:     "input_file",
						FileName: safeFileName,
						FileData: "data:application/pdf;base64," + base64.StdEncoding.EncodeToString(pdfBytes),
					},
				},
			},
		},
		Text: responsesText{
			Format: responsesJSONSchemaFormat{
				Type:   "json_schema",
				Name:   "school_notice",
				Strict: true,
				Schema: model.SchoolNoticeJSONSchema,
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to build orcarouter request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+responsesPath, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to build orcarouter request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", ErrTimeout
		}
		return "", fmt.Errorf("%w: %s", ErrConnection, redactSecret(err.Error(), c.apiKey))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBodyBytes))
	if err != nil {
		return "", fmt.Errorf("%w: failed to read response body", ErrUpstream)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: status %d: %s", ErrUpstream, resp.StatusCode, redactSecret(string(body), c.apiKey))
	}

	var parsed responsesResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("%w: failed to decode response", ErrUpstream)
	}

	return extractOutputText(parsed), nil
}

func extractOutputText(resp responsesResponse) string {
	if resp.OutputText != "" {
		return resp.OutputText
	}

	var sb strings.Builder
	for _, item := range resp.Output {
		for _, content := range item.Content {
			if content.Type == "output_text" {
				sb.WriteString(content.Text)
			}
		}
	}

	return sb.String()
}

// redactSecret はエラーメッセージにAPIキーが含まれている場合に取り除く。
// OrcaRouterのエラーレスポンスをそのままログや上位エラーへ含める際に、
// APIキーが漏えいしないようにするため。
func redactSecret(message, secret string) string {
	if secret == "" || message == "" {
		return message
	}

	return strings.ReplaceAll(message, secret, "[redacted]")
}
