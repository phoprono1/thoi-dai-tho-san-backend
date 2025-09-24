# Hệ Thống Quy Đổi Core Stats Thành Combat Stats

## Tổng Quan

Hệ thống game sử dụng 5 core attributes (thuộc tính cốt lõi) để tính toán các combat stats (thuộc tính chiến đấu). Core attributes bao gồm:

- **STR** (Strength): Sức mạnh - ảnh hưởng đến sát thương vật lý
- **INT** (Intelligence): Trí tuệ - ảnh hưởng đến sát thương phép thuật
- **DEX** (Dexterity): Nhanh nhẹn - ảnh hưởng đến tỷ lệ đánh trúng và né tránh
- **VIT** (Vitality): Sinh lực - ảnh hưởng đến máu và phòng thủ
- **LUK** (Luck): May mắn - ảnh hưởng đến tỷ lệ chí mạng

## Cơ Chế Quy Đổi

### 1. Hàm Effective (Hiệu Ứng)

Trước khi quy đổi, mỗi core attribute được xử lý qua hàm `effective()`:

```typescript
effective(attr) = Math.pow(Math.max(0, attr), 0.94)
```

**Ý nghĩa**: Hàm này làm cho việc tăng stats trở nên khó hơn khi stats cao, tạo cảm giác progression hợp lý.

### 2. Công Thức Quy Đổi Chi Tiết

#### Base Values
- `baseAttack = 10`
- `baseMaxHp = 100`
- `baseDefense = 5`

#### Attack (Sát Thương)
```typescript
attack = Math.floor(
  baseAttack +
  0.45 × effective(STR) +
  0.6 × effective(INT) +
  0.18 × effective(DEX)
)
```

#### Max HP (Máu Tối Đa)
```typescript
maxHp = Math.floor(baseMaxHp + 12 × effective(VIT))
```

#### Defense (Phòng Thủ)
```typescript
defense = Math.floor(baseDefense + 0.5 × effective(VIT))
```

#### Crit Rate (Tỷ Lệ Chí Mạng)
```typescript
critRate = Math.min(75, 0.28 × effective(LUK))
```
- **Giới hạn tối đa**: 75%

#### Crit Damage (Sát Thương Chí Mạng)
```typescript
critDamage = 150 + (0.15 × effective(LUK))
```
- **Base**: 150% (1.5x damage)
- **Bonus**: +0.15% per effective LUK point

#### Dodge Rate (Tỷ Lệ Né Tránh)
```typescript
dodgeRate = Math.min(70, 0.25 × effective(DEX))
```
- **Giới hạn tối đa**: 70%

#### Accuracy (Tỷ Lệ Đánh Trúng)
```typescript
accuracy = 0.35 × effective(DEX)
```

#### Armor Penetration (Xuyên Giáp)
```typescript
armorPen = 0.02 × effective(STR)
```

#### Lifesteal (Hút Máu)
```typescript
lifesteal = 0.03 × effective(STR)
```

#### Combo Rate (Tỷ Lệ Liên Kích)
```typescript
comboRate = 0.08 × effective(DEX)
```

#### Max Mana (Mana Tối Đa)
```typescript
maxMana = Math.max(50, Math.floor(INT × 10))
```
- **Minimum**: 50 mana

## Ví Dụ Minh Họa

### User A: Newbie Player
**Core Stats:**
- STR: 10, INT: 10, DEX: 10, VIT: 10, LUK: 10
- Không có điểm đã invest thêm

**Quy trình tính toán:**

1. **Effective values:**
   - STR_eff = 10^0.94 = 8.68
   - INT_eff = 10^0.94 = 8.68
   - DEX_eff = 10^0.94 = 8.68
   - VIT_eff = 10^0.94 = 8.68
   - LUK_eff = 10^0.94 = 8.68

2. **Combat Stats kết quả:**
   - **Attack**: floor(10 + 0.45×8.68 + 0.6×8.68 + 0.18×8.68) = floor(10 + 3.91 + 5.21 + 1.56) = **20**
   - **Max HP**: floor(100 + 12×8.68) = floor(100 + 104.16) = **204**
   - **Defense**: floor(5 + 0.5×8.68) = floor(5 + 4.34) = **9**
   - **Crit Rate**: min(75, 0.28×8.68) = min(75, 2.43) = **2.43%**
   - **Crit Damage**: 150 + 0.15×8.68 = 150 + 1.30 = **151.3%**
   - **Dodge Rate**: min(70, 0.25×8.68) = min(70, 2.17) = **2.17%**
   - **Accuracy**: 0.35×8.68 = **3.04%**
   - **Armor Pen**: 0.02×8.68 = **0.17%**
   - **Lifesteal**: 0.03×8.68 = **0.26%**
   - **Combo Rate**: 0.08×8.68 = **0.69%**
   - **Max Mana**: max(50, floor(10×10)) = max(50, 100) = **100**

### User B: Advanced Player (Level 50+)
**Core Stats (bao gồm level bonuses và equipment):**
- STR: 85, INT: 72, DEX: 68, VIT: 90, LUK: 55
- Đã invest thêm: STR+15, INT+10, DEX+8, VIT+12, LUK+5

**Tổng core stats:**
- STR_total: 85 + 15 = 100
- INT_total: 72 + 10 = 82
- DEX_total: 68 + 8 = 76
- VIT_total: 90 + 12 = 102
- LUK_total: 55 + 5 = 60

**Quy trình tính toán:**

1. **Effective values:**
   - STR_eff = 100^0.94 = 67.61
   - INT_eff = 82^0.94 = 56.02
   - DEX_eff = 76^0.94 = 51.85
   - VIT_eff = 102^0.94 = 69.22
   - LUK_eff = 60^0.94 = 41.05

2. **Combat Stats kết quả:**
   - **Attack**: floor(10 + 0.45×67.61 + 0.6×56.02 + 0.18×51.85) = floor(10 + 30.42 + 33.61 + 9.33) = **83**
   - **Max HP**: floor(100 + 12×69.22) = floor(100 + 830.64) = **930**
   - **Defense**: floor(5 + 0.5×69.22) = floor(5 + 34.61) = **39**
   - **Crit Rate**: min(75, 0.28×41.05) = min(75, 11.49) = **11.49%**
   - **Crit Damage**: 150 + 0.15×41.05 = 150 + 6.16 = **156.16%**
   - **Dodge Rate**: min(70, 0.25×51.85) = min(70, 12.96) = **12.96%**
   - **Accuracy**: 0.35×51.85 = **18.15%**
   - **Armor Pen**: 0.02×67.61 = **1.35%**
   - **Lifesteal**: 0.03×67.61 = **2.03%**
   - **Combo Rate**: 0.08×51.85 = **4.15%**
   - **Max Mana**: max(50, floor(82×10)) = max(50, 820) = **820**

## Lưu Ý Quan Trọng

1. **Scaling**: Hàm `effective()` với exponent 0.94 làm cho việc tăng stats trở nên khó hơn khi stats cao, khuyến khích đa dạng hóa thay vì chỉ focus vào 1 stat.

2. **Caps**: Một số stats có giới hạn tối đa (crit rate 75%, dodge 70%) để tránh imbalance.

3. **Mana**: Mana được tính trực tiếp từ INT base (không qua effective function) và có minimum 50.

4. **Allocations**: Player có thể invest thêm points vào các attributes, được cộng trực tiếp vào core stats trước khi tính effective.

5. **Level Bonuses**: Level bonuses được cộng vào core stats trước khi quy đổi.

6. **Equipment**: Equipment bonuses cũng được cộng vào core stats theo cách tương tự.

## Công Thức Tóm Tắt

```
Core Stats → Effective Values → Combat Stats
     ↓              ↓              ↓
   STR/INT/... → attr^0.94 → Attack/HP/Defense/...
```

File này được tạo tự động từ code backend. Cập nhật code sẽ yêu cầu cập nhật tài liệu này.</content>
<parameter name="filePath">f:\VKU\self_project\Game\thoi-dai-tho-san\backend\STAT_CONVERSION_GUIDE.md