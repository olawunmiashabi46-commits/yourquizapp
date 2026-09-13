export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { adminKey } = req.body || {};

  // The real key will be stored in Vercel Environment Variables
  const correctAdminKey = process.env.ADMIN_PASS_KEY;

  if (!correctAdminKey) {
    return res.status(500).json({
      success: false,
      message: "Admin key is not configured on the server.",
    });
  }

  if (!adminKey || adminKey !== correctAdminKey) {
    return res.status(401).json({
      success: false,
      message: "Incorrect admin pass key.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Admin access granted.",
  });
}