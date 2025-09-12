# TypeORM Migration Commands Guide

## Các lệnh migration chuẩn:

### 1. Tạo migration tự động (KHUYẾN NGHỊ)
```bash
# Sau khi sửa đổi entities, chạy lệnh này
npm run migration:generate src/migrations/TenMigration

# Ví dụ:
npm run migration:generate src/migrations/AddUserAvatarColumn
npm run migration:generate src/migrations/UpdateItemSystem
npm run migration:generate src/migrations/AddGuildFeatures
```

### 2. Tạo migration trống (chỉ khi cần custom)
```bash
npm run migration:create src/migrations/TenMigration
```

### 3. Chạy migration
```bash
npm run migration:run
```

### 4. Revert migration (undo)
```bash
npm run migration:revert
```

### 5. Kiểm tra schema differences
```bash
npm run typeorm -- migration:generate -d src/data-source.ts --dr src/migrations/CheckDiff
# --dr (dry run) sẽ show SQL mà không tạo file
```

## Quy trình development chuẩn:

### Bước 1: Thay đổi Entity
```typescript
// Ví dụ: Thêm cột avatar vào User entity
@Entity()
export class User {
  // ... existing columns
  
  @Column({ nullable: true })
  avatar?: string;
}
```

### Bước 2: Generate Migration
```bash
npm run migration:generate src/migrations/AddUserAvatar
```

### Bước 3: Review Migration
- Kiểm tra file migration được tạo
- Đảm bảo SQL commands đúng
- Test trên database development

### Bước 4: Run Migration
```bash
npm run migration:run
```

### Bước 5: Commit & Deploy
```bash
git add .
git commit -m "feat: Add user avatar column"
git push
```

## Lưu ý quan trọng:

1. **LUÔN review migration trước khi run**
2. **Test trên development trước production**
3. **Backup database trước khi run migration trên production**
4. **Không sửa migration đã chạy, tạo migration mới để fix**
5. **Sử dụng migration:generate thay vì tạo thủ công**

## Production Deployment:
- Migration sẽ tự động chạy khi container start (đã config trong Dockerfile)
- Hoặc chạy thủ công: `npm run migration:run` trước khi start app