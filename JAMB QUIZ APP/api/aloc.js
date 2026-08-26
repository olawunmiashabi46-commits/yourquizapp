export default async function handler(req, res) {
    try {
        const { subject, limit = 40 } = req.query;

        if (!subject) {
            return res.status(400).json({
                error: 'Subject is required'
            });
        }

        const apiKey = process.env.ALOC_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: 'ALOC_API_KEY is not configured'
            });
        }

        const url =
            `https://dev.aloc.com.ng/api/v1/questions` +
            `?subject=${encodeURIComponent(subject)}` +
            `&examType=jamb` +
            `&limit=${Math.min(Number(limit) || 40, 50)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': apiKey
            }
        });

        const text = await response.text();

        if (!response.ok) {
            console.error(
                'ALOC API error:',
                response.status,
                text
            );

            return res.status(response.status).json({
                error: 'ALOC API request failed',
                status: response.status,
                details: text
            });
        }

        const result = JSON.parse(text);

        return res.status(200).json(result);

    } catch (error) {
        console.error('ALOC server error:', error);

        return res.status(500).json({
            error: 'Could not connect to ALOC API',
            details: error.message
        });
    }
}