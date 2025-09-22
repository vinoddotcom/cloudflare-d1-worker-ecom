export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString()
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
};