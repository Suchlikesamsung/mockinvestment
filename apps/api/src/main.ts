import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();

function isAllowedOrigin(origin: string) {
  const configuredOrigin = process.env.WEB_ORIGIN;

  if (configuredOrigin && origin === configuredOrigin) {
    return true;
  }

  return /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/.test(origin);
}
