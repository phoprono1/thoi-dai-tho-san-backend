import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';

async function createTestUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  try {
    // Tạo user test
    const user = await authService.register('testuser', 'testpass123');
    console.log('User created:', user);

    // Tạo thêm một số user khác
    await authService.register('player1', 'password123');
    await authService.register('player2', 'password123');

    console.log('Test users created successfully!');
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await app.close();
  }
}

createTestUser();
