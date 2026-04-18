// pm2 ecosystem config — cluster mode for 1,000 concurrent users
// Run: pm2 start ecosystem.config.cjs
// Monitor: pm2 monit
// Logs: pm2 logs deep-server
// Reload (zero-downtime): pm2 reload deep-server

module.exports = {
  apps: [
    {
      name: 'deep-server',

      // ── Process entry ────────────────────────────────────────────────────────
      script:      './apps/server/dist/index.js',
      interpreter: 'node',
      node_args:   '--max-old-space-size=512', // 512MB per worker

      // ── Cluster mode ─────────────────────────────────────────────────────────
      // "max" = one worker per CPU core. With Redis adapter, all workers
      // share socket state so users on different workers still get events.
      exec_mode: 'cluster',
      instances: 'max',

      // ── Environment ──────────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT:     3000,
      },
      env_production: {
        NODE_ENV:   'production',
        PORT:       3000,
        // DATABASE_URL, JWT_SECRET, REDIS_URL, CLOUDINARY_* come from system env
      },

      // ── Reliability ──────────────────────────────────────────────────────────
      autorestart:         true,
      max_restarts:        10,
      min_uptime:          '5s',          // Must stay up 5s to count as "started"
      restart_delay:       3000,          // 3s between restart attempts
      exp_backoff_restart_delay: 100,     // Exponential back-off on repeated crashes

      // ── Logging ──────────────────────────────────────────────────────────────
      out_file:     './logs/out.log',
      error_file:   './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:   true,                // Combine logs from all worker instances

      // ── Memory guard ─────────────────────────────────────────────────────────
      // Restart a worker if it exceeds 512MB (memory leak safety valve)
      max_memory_restart: '512M',

      // ── Graceful shutdown ─────────────────────────────────────────────────────
      kill_timeout:  5000,   // Wait 5s for SIGTERM before SIGKILL
      listen_timeout: 8000,  // Wait 8s for worker to become ready
      shutdown_with_message: false,
    },
  ],
};
