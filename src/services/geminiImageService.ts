/**
 * Gemini Image Generation Service
 * 
 * Invokes Google Gemini Vision & Multimodal Image Generation models
 * to generate photorealistic restaurant food photography.
 * Includes circuit-breaker protection for API quota exhaustion (HTTP 429)
 * to prevent redundant retries and console spam.
 */

export interface GeneratedImageResult {
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  modelUsed?: string;
  quotaExceeded?: boolean;
  error?: string;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// High-performance Gemini Image Generation models in priority order
const IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
];

// Circuit breaker state to avoid hammering the API when quota is exhausted
let quotaCooldownUntil = 0;
let hasLoggedQuotaNotice = false;

export const geminiImageService = {
  /**
   * Resets circuit breaker (e.g. for testing or manual retry)
   */
  resetCircuitBreaker(): void {
    quotaCooldownUntil = 0;
    hasLoggedQuotaNotice = false;
  },

  /**
   * Checks if image quota is currently in cooldown
   */
  isQuotaCooldownActive(): boolean {
    return Date.now() < quotaCooldownUntil;
  },

  /**
   * Generates a photorealistic food image from a detailed culinary prompt
   * using Gemini Image Generation capability.
   */
  async generateFoodImage(prompt: string): Promise<GeneratedImageResult> {
    if (!prompt || !prompt.trim()) {
      return { success: false, error: 'No prompt provided for image generation' };
    }

    // Circuit breaker: If free-tier quota is exhausted, failover immediately without latency or log spam
    if (Date.now() < quotaCooldownUntil) {
      return {
        success: false,
        quotaExceeded: true,
        error: 'Gemini image generation quota exceeded (cooling down)',
      };
    }

    let lastError = '';

    for (const model of IMAGE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(18000), // 18s timeout for image synthesis
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              imageConfig: {
                aspectRatio: '1:1',
              },
            },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            // Free-tier API keys don't include Gemini image synthesis quota
            quotaCooldownUntil = Date.now() + 10 * 60 * 1000; // 10-minute cooldown
            if (!hasLoggedQuotaNotice) {
              console.log(
                '[CounterPro AI] Note: Gemini image synthesis quota reached (HTTP 429). Automatically using verified high-resolution restaurant food photography.'
              );
              hasLoggedQuotaNotice = true;
            }
            return {
              success: false,
              quotaExceeded: true,
              error: 'Gemini image quota exceeded (HTTP 429)',
            };
          }

          lastError = `Model ${model} returned HTTP ${status}`;
          continue;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;

        if (Array.isArray(parts)) {
          for (const p of parts) {
            const inline = p.inlineData || p.inline_data;
            if (inline && inline.data) {
              const mimeType = inline.mimeType || inline.mime_type || 'image/jpeg';
              return {
                success: true,
                base64Data: inline.data,
                mimeType,
                modelUsed: model,
              };
            }
          }
        }

        lastError = `Model ${model} completed without image payload`;
      } catch (err: any) {
        lastError = `Model ${model} error: ${err.message || 'Request failed'}`;
      }
    }

    return {
      success: false,
      error: lastError || 'Image generation unavailable',
    };
  },
};
