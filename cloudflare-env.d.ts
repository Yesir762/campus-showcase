declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_SETUP_TOKEN?: string;
    CONVERTER_TOKEN?: string;
    CONVERSION_TIMEOUT_MS?: string;
    MAX_SOURCE_BYTES?: string;
    BUCKET?: R2Bucket;
  }
}
