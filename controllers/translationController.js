const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

const supportedLanguages = new Set(["en", "hi", "bn", "ta", "te", "mr", "gu"]);

const translateTexts = asyncHandler(async (req, res) => {
  const { texts, target } = req.body;
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > 30) {
    throw new ApiError(400, "Translate between 1 and 30 text items at a time.");
  }
  if (!supportedLanguages.has(target) || target === "en") {
    throw new ApiError(400, "Choose a supported non-English language.");
  }
  if (texts.some((text) => typeof text !== "string" || !text.trim() || text.length > 3000)) {
    throw new ApiError(400, "Each text item must contain between 1 and 3,000 characters.");
  }

  const configuredUrl = process.env.LIBRETRANSLATE_URL;
  if (!configuredUrl) {
    throw new ApiError(
      503,
      "Automatic translation is not configured. Set LIBRETRANSLATE_URL to your self-hosted LibreTranslate service."
    );
  }

  let endpoint;
  try {
    endpoint = new URL("/translate", configuredUrl.endsWith("/") ? configuredUrl : `${configuredUrl}/`);
    if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("Invalid protocol");
  } catch (_error) {
    throw new ApiError(500, "LIBRETRANSLATE_URL must be a valid HTTP or HTTPS URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        source: "auto",
        target,
        format: "text",
        ...(process.env.LIBRETRANSLATE_API_KEY
          ? { api_key: process.env.LIBRETRANSLATE_API_KEY }
          : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(504, "Translation service timed out. Please try again.");
    }
    throw new ApiError(502, "Could not connect to the configured translation service.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ApiError(502, `Translation service returned status ${response.status}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw new ApiError(502, "Translation service returned an invalid response.");
  }
  if (!data || typeof data !== "object") {
    throw new ApiError(502, "Translation service returned an invalid response.");
  }
  const translations = Array.isArray(data.translatedText)
    ? data.translatedText
    : [data.translatedText];
  if (
    translations.length !== texts.length ||
    translations.some((translation) => typeof translation !== "string")
  ) {
    throw new ApiError(502, "Translation service returned an incomplete response.");
  }

  res.status(200).json({ success: true, translations });
});

module.exports = { translateTexts };
