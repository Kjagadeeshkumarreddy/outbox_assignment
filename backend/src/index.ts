import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { initDb } from './db/init';
import { authRouter } from './api/auth.routes';
import { scheduleRouter } from './api/schedule.routes';
import { startEmailWorker } from './queue/worker';
import { runRecoverySweep } from './queue/recovery';

import path from 'path';
import fs from 'fs';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      concurrency: config.worker.concurrency,
      sendDelayMs: config.worker.sendDelayMs,
      maxPerHour: config.worker.maxEmailsPerHour,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/emails', scheduleRouter);

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

async function startServer() {
  try {
    await initDb();
    console.log('Database connected and schema ready');

    await runRecoverySweep();

    const worker = startEmailWorker();
    console.log(
      `BullMQ email worker running (concurrency: ${config.worker.concurrency}, delay: ${config.worker.sendDelayMs}ms)`
    );

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`ReachInbox Scheduler API listening on port ${config.port}`);
    });

    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      await worker.close();
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
