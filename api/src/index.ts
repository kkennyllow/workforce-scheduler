import { app } from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT ?? 4000);

async function start() {
  await prisma.$connect();

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch(async (error) => {
  console.error("Failed to start API:", error);
  await prisma.$disconnect();
  process.exit(1);
});
