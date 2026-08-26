export default async function handler(req, res) {
    try {

        const {
            subject,
            limit = 40,
            cursor
        } = req.query;

        if (!subject) {
            return res.status(400).json({
                error: 'Subject is required'
            });
        }

        const apiKey =
            process.env.ALOC_API_KEY;

        if (!apiKey) {

            console.error(
                'ALOC_API_KEY is missing'
            );

            return res.status(500).json({
                error:
                    'ALOC API key is not configured'
            });

        }

        const requestedLimit =
            Math.min(
                Math.max(
                    Number(limit) || 40,
                    1
                ),
                50
            );


        const params =
            new URLSearchParams();

        params.set(
            'subject',
            subject
        );

        params.set(
            'examType',
            'jamb'
        );

        params.set(
            'limit',
            String(requestedLimit)
        );


        if (cursor) {

            params.set(
                'cursor',
                cursor
            );

        }


        const url =
            `https://dev.aloc.com.ng/api/v1/questions?${params.toString()}`;


        console.log(
            `Requesting ALOC questions for ${subject}`
        );


        const response =
            await fetch(
                url,
                {
                    method: 'GET',

                    headers: {
                        'X-API-Key':
                            apiKey,

                        'Accept':
                            'application/json'
                    }
                }
            );


        const data =
            await response.json();


        console.log(
            `ALOC response: ${response.status}`
        );


        if (!response.ok) {

            console.error(
                'ALOC API error:',
                response.status,
                data
            );

            return res.status(
                response.status
            ).json({
                error:
                    'ALOC API request failed',

                details:
                    data
            });

        }


        return res.status(200).json(
            data
        );

    }

    catch (error) {

        console.error(
            'ALOC server error:',
            error
        );

        return res.status(500).json({
            error:
                'Unable to connect to ALOC'
        });

    }
}