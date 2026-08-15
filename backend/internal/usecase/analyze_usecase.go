package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/hiro-nono/team_z/backend/internal/model"
)

var (
	// ErrAIEmptyOutput はAIから構造化出力を取得できなかった場合のエラー
	ErrAIEmptyOutput = errors.New("ai returned empty output")
	// ErrAIInvalidJSON はAIの出力をJSONとして読み取れなかった場合のエラー
	ErrAIInvalidJSON = errors.New("ai output is not valid json")
	// ErrAISchemaValidation はAIの出力が抽出ルール(Schema)を満たさない場合のエラー
	ErrAISchemaValidation = errors.New("ai output failed schema validation")
)

// AIProvider はanalyzeUsecaseがPDFの解析に必要とする操作
type AIProvider interface {
	AnalyzePDF(ctx context.Context, fileName string, pdfBytes []byte) (string, error)
}

// AnalyzeUsecase はPDFをAIプロバイダへ送信し、構造化されたSchoolNoticeを取得・検証するユースケースを扱う
type AnalyzeUsecase struct {
	aiProvider AIProvider
}

func NewAnalyzeUsecase(aiProvider AIProvider) *AnalyzeUsecase {
	return &AnalyzeUsecase{
		aiProvider: aiProvider,
	}
}

// AnalyzePDF はPDFのバイト列をAIプロバイダへ送信し、返された構造化出力をSchoolNoticeとして
// パース・検証する。AIの出力がJSONとして不正、またはSchoolNoticeの抽出ルールを満たさない場合はエラーを返す。
// AIは事実抽出のみを行うため、各candidateのGoogle Calendar登録可否判断(ActionDecision)はここで付与する。
func (u *AnalyzeUsecase) AnalyzePDF(ctx context.Context, fileName string, pdfBytes []byte) (*model.SchoolNoticeWithDecision, error) {
	outputText, err := u.aiProvider.AnalyzePDF(ctx, fileName, pdfBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze pdf: %w", err)
	}

	outputText = stripCodeFence(outputText)
	if outputText == "" {
		return nil, ErrAIEmptyOutput
	}

	var notice model.SchoolNotice
	decoder := json.NewDecoder(strings.NewReader(outputText))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&notice); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAIInvalidJSON, err)
	}

	if err := notice.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAISchemaValidation, err)
	}

	return notice.WithDecisions(), nil
}

// stripCodeFence はAIの出力がMarkdownのコードフェンス(```json ... ```)で
// 囲まれて返ってきた場合に取り除く
func stripCodeFence(text string) string {
	trimmed := strings.TrimSpace(text)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
