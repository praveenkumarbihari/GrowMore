module.exports = {
  apps: [
    {
      name: "sip-heartbeat",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3107",
      env: { NODE_ENV: "production" },
    },
  ],
};
