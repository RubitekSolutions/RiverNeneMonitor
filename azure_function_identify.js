module.exports = async function (context, req) {
  try {
    if (req.method !== "POST") {
      context.res = {
        status: 405,
        headers: { "Content-Type": "application/json" },
        body: { error: "Method not allowed" }
      };
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      context.res = {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: { error: "Server configuration error: missing API key" }
      };
      return;
    }

    const { imageBase64, mediaType } = req.body || {};

    if (!imageBase64) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: "Missing imageBase64" }
      };
      return;
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are an expert freshwater ecologist specialising in UK macroinvertebrate identification.
Respond ONLY in valid JSON with this exact shape:
{
  "name":"common name",
  "latin":"latin name",
  "confidence":"High/Medium/Low",
  "pollutionTolerance":"Clean water indicator/Moderate tolerance/Pollution tolerant",
  "description":"2-3 sentences",
  "ecology":"1-2 sentences",
  "notes":"any caveats",
  "protectedSpecies":false
}
If not a freshwater invertebrate, set name to "Not identified".`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64
                }
              },
              {
                type: "text",
                text: "Identify this freshwater invertebrate from the River Nene, UK."
              }
            ]
          }
        ]
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      context.res = {
        status: anthropicRes.status,
        headers: { "Content-Type": "application/json" },
        body: {
          error: "Anthropic API error",
          details: data
        }
      };
      return;
    }

    const raw = data.content?.find(block => block.type === "text")?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      parsed = {
        name: "Identification unclear",
        latin: "",
        confidence: "Low",
        pollutionTolerance: "",
        description: "",
        ecology: "",
        notes: "Could not parse AI response.",
        protectedSpecies: false
      };
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: parsed
    };
  } catch (error) {
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "Server error",
        message: error.message
      }
    };
  }
};