import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Thời Đại Thợ Săn API')
    .setDescription('API documentation cho game Thời Đại Thợ Săn')
    .setVersion('1.0')
    .addTag('users', 'Quản lý người dùng')
    .addTag('auth', 'Xác thực và đăng nhập')
    .addTag('classes', 'Hệ thống class và kỹ năng')
    .addTag('combat', 'Hệ thống chiến đấu')
    .addTag('items', 'Quản lý vật phẩm')
    .addTag('dungeons', 'Quản lý dungeon')
    .addTag('user-stamina', 'Quản lý stamina')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  await app.listen(process.env.PORT ?? 3005);
}
void bootstrap();
