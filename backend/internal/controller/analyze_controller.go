package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hiro-nono/team_z/backend/internal/aiprovider"
	"github.com/hiro-nono/team_z/backend/internal/model"
	"github.com/hiro-nono/team_z/backend/internal/usecase"
)

// maxUploadSizeBytes はアップロード可能なPDFファイルサイズの上限(10MB)
const maxUploadSizeBytes = 10 * 1024 * 1024

// pdfMagicBytes はPDFファイルの先頭に付与されるマジックバイト
var pdfMagicBytes = []byte("%PDF-")

// AnalyzeUsecase はAnalyzeControllerがPDFの解析に必要とする操作
type AnalyzeUsecase interface {
	AnalyzePDF(ctx context.Context, fileName string, pdfBytes []byte) (*model.SchoolNoticeWithDecision, error)
}

type AnalyzeController struct {
	analyzeUsecase AnalyzeUsecase
}

func NewAnalyzeController(analyzeUsecase AnalyzeUsecase) *AnalyzeController {
	return &AnalyzeController{
		analyzeUsecase: analyzeUsecase,
	}
}

// Analyze はmultipart/form-dataで受け取ったPDFをAIプロバイダへ送信し、
// 構造化されたSchoolNoticeを返す。Google Calendarへの登録やAction Decisionはここでは行わない。
func (h *AnalyzeController) Analyze(c *gin.Context) {
	if !strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request must be multipart/form-data"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	if fileHeader.Size <= 0 || fileHeader.Size > maxUploadSizeBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file size must be 10MB or less"})
		return
	}

	filename := fileHeader.Filename
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType != "application/pdf" && !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "only pdf files are supported"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read uploaded file"})
		return
	}
	defer file.Close()

	// fileHeader.Sizeを上回るバイト数が読み取れた場合は不正なアップロードとして扱う
	pdfBytes, err := io.ReadAll(io.LimitReader(file, maxUploadSizeBytes+1))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}
	if len(pdfBytes) > maxUploadSizeBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file size must be 10MB or less"})
		return
	}
	if !bytes.HasPrefix(pdfBytes, pdfMagicBytes) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "uploaded file is not a valid pdf"})
		return
	}

	notice, err := h.analyzeUsecase.AnalyzePDF(c.Request.Context(), filename, pdfBytes)
	if err != nil {
		h.respondAnalyzeError(c, err)
		return
	}

	c.JSON(http.StatusOK, notice)
}

// respondAnalyzeError はAIプロバイダ/解析処理で発生したエラーを、詳細を漏らさない
// 適切なHTTPエラーへ変換する。OrcaRouterからのレスポンスをそのままFrontendへ返すことはしない。
func (h *AnalyzeController) respondAnalyzeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, aiprovider.ErrNotConfigured):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ai provider is not configured"})
	case errors.Is(err, aiprovider.ErrTimeout):
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": "ai analysis timed out"})
	case errors.Is(err, aiprovider.ErrConnection):
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to connect to ai provider"})
	case errors.Is(err, aiprovider.ErrUpstream):
		c.JSON(http.StatusBadGateway, gin.H{"error": "ai provider returned an error"})
	case errors.Is(err, usecase.ErrAIEmptyOutput),
		errors.Is(err, usecase.ErrAIInvalidJSON),
		errors.Is(err, usecase.ErrAISchemaValidation):
		c.JSON(http.StatusBadGateway, gin.H{"error": "ai returned an invalid response"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to analyze pdf"})
	}
}
