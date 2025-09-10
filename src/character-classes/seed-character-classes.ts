import { DataSource } from 'typeorm';
import { CharacterClass, ClassType, ClassTier } from './character-class.entity';

export async function seedCharacterClasses(dataSource: DataSource) {
  const characterClassRepository = dataSource.getRepository(CharacterClass);

  // Clear existing data
  await characterClassRepository.clear();

  // Basic Classes (Tier 1) - No requirements, available from level 1
  const basicClasses = [
    {
      name: 'Chiến Binh',
      description: 'Lớp chiến binh cơ bản, tập trung vào sức mạnh và phòng thủ',
      type: ClassType.WARRIOR,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        strength: 5,
        vitality: 5,
      },
      skillUnlocks: [
        {
          skillId: 1,
          skillName: 'Đánh Thường',
          description: 'Đòn đánh cơ bản với kiếm',
        },
        {
          skillId: 2,
          skillName: 'Phòng Thủ',
          description: 'Tăng khả năng phòng thủ tạm thời',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
    {
      name: 'Pháp Sư',
      description:
        'Lớp pháp sư cơ bản, tập trung vào trí tuệ và sức mạnh phép thuật',
      type: ClassType.MAGE,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        intelligence: 5,
        vitality: 3,
      },
      skillUnlocks: [
        {
          skillId: 3,
          skillName: 'Bắn Phép Cơ Bản',
          description: 'Bắn một quả cầu phép thuật nhỏ',
        },
        {
          skillId: 4,
          skillName: 'Hồi Phục',
          description: 'Hồi phục một lượng HP nhỏ',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
    {
      name: 'Xạ Thủ',
      description: 'Lớp xạ thủ cơ bản, tập trung vào độ chính xác và tốc độ',
      type: ClassType.ARCHER,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        dexterity: 5,
        vitality: 3,
      },
      skillUnlocks: [
        {
          skillId: 5,
          skillName: 'Bắn Tên Cơ Bản',
          description: 'Bắn một mũi tên với độ chính xác cao',
        },
        {
          skillId: 6,
          skillName: 'Nhanh Nhẹn',
          description: 'Tăng tốc độ di chuyển tạm thời',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
    {
      name: 'Sát Thủ',
      description:
        'Lớp sát thủ cơ bản, tập trung vào độ nhanh nhẹn và sát thương chí mạng',
      type: ClassType.ASSASSIN,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        dexterity: 4,
        luck: 4,
      },
      skillUnlocks: [
        {
          skillId: 7,
          skillName: 'Đâm Xuyên',
          description: 'Đòn đâm nhanh gây sát thương chí mạng',
        },
        {
          skillId: 8,
          skillName: 'Ẩn Nấp',
          description: 'Ẩn thân để tránh bị phát hiện',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
    {
      name: 'Hộ Mệnh',
      description:
        'Lớp hộ mệnh cơ bản, tập trung vào phòng thủ và bảo vệ đồng đội',
      type: ClassType.TANK,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        vitality: 6,
        strength: 2,
      },
      skillUnlocks: [
        {
          skillId: 9,
          skillName: 'Chịu Đòn',
          description: 'Giảm sát thương nhận vào',
        },
        {
          skillId: 10,
          skillName: 'Khiên Phòng Thủ',
          description: 'Tạo lá chắn bảo vệ đồng đội',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
    {
      name: 'Hồi Phục',
      description:
        'Lớp hồi phục cơ bản, tập trung vào hồi phục và hỗ trợ đồng đội',
      type: ClassType.HEALER,
      tier: ClassTier.BASIC,
      requiredLevel: 1,
      statBonuses: {
        intelligence: 4,
        vitality: 4,
      },
      skillUnlocks: [
        {
          skillId: 11,
          skillName: 'Hồi Phục Nhỏ',
          description: 'Hồi phục HP cho một đồng đội',
        },
        {
          skillId: 12,
          skillName: 'Phù Hộ',
          description: 'Tăng khả năng phòng thủ cho đồng đội',
        },
      ],
      advancementRequirements: undefined,
      previousClassId: undefined,
    },
  ];

  // Advanced Classes (Tier 2) - Require level 10 and dungeon completions
  const advancedClasses = [
    {
      name: 'Kiếm Sĩ Ma Pháp',
      description: 'Chiến binh kết hợp sức mạnh vật lý và phép thuật',
      type: ClassType.WARRIOR,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        strength: 8,
        intelligence: 3,
        vitality: 6,
      },
      skillUnlocks: [
        {
          skillId: 13,
          skillName: 'Kiếm Ma Pháp',
          description: 'Đòn đánh kết hợp sức mạnh và phép thuật',
        },
        {
          skillId: 14,
          skillName: 'Khiên Ma Pháp',
          description: 'Tạo lá chắn phép thuật bảo vệ',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 1,
            dungeonName: 'Hang Rắn Độc',
            requiredCompletions: 5,
          },
          {
            dungeonId: 2,
            dungeonName: 'Rừng Ma Ám',
            requiredCompletions: 3,
          },
        ],
        quests: [
          {
            questId: 1,
            questName: 'Bài Thử Chiến Binh',
          },
        ],
        items: [
          {
            itemId: 1,
            itemName: 'Kiếm Đồng',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Pháp Sư Băng Giá',
      description: 'Pháp sư chuyên về phép thuật băng và lạnh',
      type: ClassType.MAGE,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        intelligence: 8,
        vitality: 4,
        dexterity: 2,
      },
      skillUnlocks: [
        {
          skillId: 15,
          skillName: 'Băng Tung',
          description: 'Tạo ra những mũi băng sắc nhọn',
        },
        {
          skillId: 16,
          skillName: 'Tường Băng',
          description: 'Tạo tường băng để chặn đường kẻ địch',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 3,
            dungeonName: 'Hang Băng Giá',
            requiredCompletions: 5,
          },
        ],
        quests: [
          {
            questId: 2,
            questName: 'Bài Thử Pháp Sư',
          },
        ],
        items: [
          {
            itemId: 2,
            itemName: 'Phù Thủy Đồng',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Xạ Thủ Băng Giá',
      description: 'Xạ thủ sử dụng cung băng để bắn tên lạnh lẽo',
      type: ClassType.ARCHER,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        dexterity: 7,
        intelligence: 3,
        vitality: 4,
      },
      skillUnlocks: [
        {
          skillId: 17,
          skillName: 'Tên Băng',
          description: 'Bắn tên băng gây sát thương và làm chậm',
        },
        {
          skillId: 18,
          skillName: 'Mưa Tên Băng',
          description: 'Bắn nhiều mũi tên băng cùng lúc',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 4,
            dungeonName: 'Rừng Tuyết',
            requiredCompletions: 4,
          },
        ],
        quests: [
          {
            questId: 3,
            questName: 'Bài Thử Xạ Thủ',
          },
        ],
        items: [
          {
            itemId: 3,
            itemName: 'Cung Đồng',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Sát Thủ Ma Ám',
      description: 'Sát thủ sử dụng bóng tối để ẩn nấp và tấn công',
      type: ClassType.ASSASSIN,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        dexterity: 6,
        luck: 6,
        strength: 2,
      },
      skillUnlocks: [
        {
          skillId: 19,
          skillName: 'Đòn Tử Thần',
          description: 'Đòn đánh chí mạng từ bóng tối',
        },
        {
          skillId: 20,
          skillName: 'Bóng Ma',
          description: 'Tạo bóng ma để đánh lạc hướng kẻ địch',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 5,
            dungeonName: 'Đền Ma Ám',
            requiredCompletions: 6,
          },
        ],
        quests: [
          {
            questId: 4,
            questName: 'Bài Thử Sát Thủ',
          },
        ],
        items: [
          {
            itemId: 4,
            itemName: 'Dao Đồng',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Hộ Mệnh Thánh',
      description: 'Hộ mệnh sử dụng sức mạnh thần linh để bảo vệ',
      type: ClassType.TANK,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        vitality: 9,
        strength: 3,
        intelligence: 2,
      },
      skillUnlocks: [
        {
          skillId: 21,
          skillName: 'Khiên Thánh',
          description: 'Tạo lá chắn thần linh mạnh mẽ',
        },
        {
          skillId: 22,
          skillName: 'Phù Hộ Thánh',
          description: 'Bảo vệ toàn bộ đồng đội',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 6,
            dungeonName: 'Đền Thánh',
            requiredCompletions: 4,
          },
        ],
        quests: [
          {
            questId: 5,
            questName: 'Bài Thử Hộ Mệnh',
          },
        ],
        items: [
          {
            itemId: 5,
            itemName: 'Giáp Đồng',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Trị Liệu Thánh',
      description: 'Trị liệu sử dụng phép thuật thần linh để hồi phục',
      type: ClassType.HEALER,
      tier: ClassTier.ADVANCED,
      requiredLevel: 10,
      statBonuses: {
        intelligence: 7,
        vitality: 5,
        luck: 2,
      },
      skillUnlocks: [
        {
          skillId: 23,
          skillName: 'Hồi Phục Thánh',
          description: 'Hồi phục lượng lớn HP cho đồng đội',
        },
        {
          skillId: 24,
          skillName: 'Phù Hộ Thánh',
          description: 'Tăng tất cả chỉ số cho đồng đội',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 7,
            dungeonName: 'Đền Trị Liệu',
            requiredCompletions: 3,
          },
        ],
        quests: [
          {
            questId: 6,
            questName: 'Bài Thử Trị Liệu',
          },
        ],
        items: [
          {
            itemId: 6,
            itemName: 'Trượng Đồng',
            quantity: 1,
          },
        ],
      },
    },
  ];

  // Master Classes (Tier 3) - Require level 50 and more challenging requirements
  const masterClasses = [
    {
      name: 'Vua Kiếm Bóng Tối',
      description: 'Chiến binh tối cao kết hợp sức mạnh bóng tối và kiếm thuật',
      type: ClassType.WARRIOR,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        strength: 12,
        intelligence: 5,
        vitality: 8,
        luck: 3,
      },
      skillUnlocks: [
        {
          skillId: 25,
          skillName: 'Vũ Điệu Bóng Tối',
          description: 'Trận chiến vũ với sức mạnh bóng tối',
        },
        {
          skillId: 26,
          skillName: 'Kiếm Vực Bóng Tối',
          description: 'Tạo ra vực bóng tối nuốt chửng kẻ địch',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 8,
            dungeonName: 'Lăng Tẩm Bóng Tối',
            requiredCompletions: 10,
          },
          {
            dungeonId: 9,
            dungeonName: 'Đỉnh Núi Ma Quỷ',
            requiredCompletions: 5,
          },
        ],
        quests: [
          {
            questId: 7,
            questName: 'Thử Thách Vua Kiếm',
          },
          {
            questId: 8,
            questName: 'Chinh Phục Bóng Tối',
          },
        ],
        items: [
          {
            itemId: 7,
            itemName: 'Kiếm Bóng Tối',
            quantity: 1,
          },
          {
            itemId: 8,
            itemName: 'Linh Hồn Ma Quỷ',
            quantity: 10,
          },
        ],
      },
    },
    {
      name: 'Phù Thủy Hỗn Mang',
      description: 'Pháp sư tối cao kiểm soát sức mạnh hỗn mang',
      type: ClassType.MAGE,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        intelligence: 12,
        vitality: 6,
        dexterity: 4,
        luck: 2,
      },
      skillUnlocks: [
        {
          skillId: 27,
          skillName: 'Hỗn Mang Tận Thế',
          description: 'Triệu hồi sức mạnh hỗn mang hủy diệt',
        },
        {
          skillId: 28,
          skillName: 'Lưới Ma Pháp',
          description: 'Tạo lưới phép thuật giam cầm kẻ địch',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 10,
            dungeonName: 'Tháp Phù Thủy',
            requiredCompletions: 8,
          },
        ],
        quests: [
          {
            questId: 9,
            questName: 'Thử Thách Phù Thủy',
          },
        ],
        items: [
          {
            itemId: 9,
            itemName: 'Trượng Hỗn Mang',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Xạ Thủ Băng Giá Tối Cao',
      description: 'Xạ thủ tối cao với sức mạnh băng giá vô song',
      type: ClassType.ARCHER,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        dexterity: 10,
        intelligence: 5,
        vitality: 6,
        luck: 3,
      },
      skillUnlocks: [
        {
          skillId: 29,
          skillName: 'Bão Tuyết Tận Thế',
          description: 'Triệu hồi bão tuyết hủy diệt',
        },
        {
          skillId: 30,
          skillName: 'Tên Băng Vĩnh Cửu',
          description: 'Tên băng không thể tan chảy',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 11,
            dungeonName: 'Vực Băng Giá',
            requiredCompletions: 7,
          },
        ],
        quests: [
          {
            questId: 10,
            questName: 'Thử Thách Xạ Thủ',
          },
        ],
        items: [
          {
            itemId: 10,
            itemName: 'Cung Băng Giá',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Sát Thủ Hồn Ma',
      description: 'Sát thủ tối cao thao túng linh hồn kẻ địch',
      type: ClassType.ASSASSIN,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        dexterity: 9,
        luck: 9,
        strength: 4,
        intelligence: 2,
      },
      skillUnlocks: [
        {
          skillId: 31,
          skillName: 'Hồn Ma Cuồng Nộ',
          description: 'Triệu hồi hồn ma tấn công kẻ địch',
        },
        {
          skillId: 32,
          skillName: 'Ảo Ảnh Tử Thần',
          description: 'Tạo ảo ảnh đánh lạc hướng và sát thương',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 12,
            dungeonName: 'Địa Ngục Hồn Ma',
            requiredCompletions: 9,
          },
        ],
        quests: [
          {
            questId: 11,
            questName: 'Thử Thách Sát Thủ',
          },
        ],
        items: [
          {
            itemId: 11,
            itemName: 'Dao Hồn Ma',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Thánh Giả Bất Tử',
      description: 'Hộ mệnh tối cao với sức mạnh thần linh bất tử',
      type: ClassType.TANK,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        vitality: 13,
        strength: 5,
        intelligence: 4,
        luck: 2,
      },
      skillUnlocks: [
        {
          skillId: 33,
          skillName: 'Khiên Bất Tử',
          description: 'Tạo lá chắn bất tử bảo vệ toàn đội',
        },
        {
          skillId: 34,
          skillName: 'Sức Mạnh Thần Linh',
          description: 'Tăng sức mạnh cho toàn bộ đồng đội',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 13,
            dungeonName: 'Thiên Đàng',
            requiredCompletions: 6,
          },
        ],
        quests: [
          {
            questId: 12,
            questName: 'Thử Thách Thánh Giả',
          },
        ],
        items: [
          {
            itemId: 12,
            itemName: 'Giáp Thánh',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Đạo Sĩ Hỗn Mang',
      description: 'Trị liệu tối cao sử dụng sức mạnh hỗn mang để hồi phục',
      type: ClassType.HEALER,
      tier: ClassTier.MASTER,
      requiredLevel: 50,
      statBonuses: {
        intelligence: 10,
        vitality: 7,
        luck: 5,
        dexterity: 2,
      },
      skillUnlocks: [
        {
          skillId: 35,
          skillName: 'Hồi Sinh Hỗn Mang',
          description: 'Hồi sinh đồng đội với sức mạnh hỗn mang',
        },
        {
          skillId: 36,
          skillName: 'Phù Hộ Vĩnh Cửu',
          description: 'Buff vĩnh viễn cho toàn đội',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 14,
            dungeonName: 'Đền Hỗn Mang',
            requiredCompletions: 5,
          },
        ],
        quests: [
          {
            questId: 13,
            questName: 'Thử Thách Đạo Sĩ',
          },
        ],
        items: [
          {
            itemId: 13,
            itemName: 'Trượng Hỗn Mang',
            quantity: 1,
          },
        ],
      },
    },
  ];

  // Legendary Classes (Tier 4) - Require level 100 and ultimate requirements
  const legendaryClasses = [
    {
      name: 'Thần Kiếm Hỗn Mang',
      description:
        'Chiến binh huyền thoại nắm giữ sức mạnh hỗn mang tối thượng',
      type: ClassType.WARRIOR,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        strength: 15,
        intelligence: 8,
        vitality: 10,
        luck: 5,
        dexterity: 2,
      },
      skillUnlocks: [
        {
          skillId: 37,
          skillName: 'Hỗn Mang Thần Kiếm',
          description: 'Thần kiếm chứa đựng sức mạnh hỗn mang hủy diệt',
        },
        {
          skillId: 38,
          skillName: 'Vũ Trụ Băng Giá',
          description: 'Tạo vũ trụ băng giá đông cứng mọi thứ',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 15,
            dungeonName: 'Vũ Trụ Hỗn Mang',
            requiredCompletions: 15,
          },
          {
            dungeonId: 16,
            dungeonName: 'Lăng Mộ Thần Linh',
            requiredCompletions: 10,
          },
        ],
        quests: [
          {
            questId: 14,
            questName: 'Thử Thách Thần Kiếm',
          },
          {
            questId: 15,
            questName: 'Chinh Phục Hỗn Mang',
          },
        ],
        items: [
          {
            itemId: 14,
            itemName: 'Thần Kiếm Hỗn Mang',
            quantity: 1,
          },
          {
            itemId: 15,
            itemName: 'Linh Hồn Thần Linh',
            quantity: 50,
          },
        ],
      },
    },
    {
      name: 'Phù Thủy Vũ Trụ',
      description: 'Pháp sư huyền thoại kiểm soát sức mạnh vũ trụ',
      type: ClassType.MAGE,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        intelligence: 15,
        vitality: 8,
        dexterity: 5,
        luck: 4,
        strength: 3,
      },
      skillUnlocks: [
        {
          skillId: 39,
          skillName: 'Vũ Trụ Hỗn Loạn',
          description: 'Triệu hồi sức mạnh vũ trụ hỗn loạn',
        },
        {
          skillId: 40,
          skillName: 'Thời Gian Đóng Băng',
          description: 'Đóng băng thời gian trong phạm vi lớn',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 17,
            dungeonName: 'Tháp Vũ Trụ',
            requiredCompletions: 12,
          },
        ],
        quests: [
          {
            questId: 16,
            questName: 'Thử Thách Phù Thủy Vũ Trụ',
          },
        ],
        items: [
          {
            itemId: 16,
            itemName: 'Trượng Vũ Trụ',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Xạ Thủ Hỗn Mang',
      description: 'Xạ thủ huyền thoại với sức mạnh hỗn mang vô song',
      type: ClassType.ARCHER,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        dexterity: 13,
        intelligence: 7,
        vitality: 8,
        luck: 5,
        strength: 2,
      },
      skillUnlocks: [
        {
          skillId: 41,
          skillName: 'Mưa Tên Hỗn Mang',
          description: 'Triệu hồi mưa tên hỗn mang từ vũ trụ',
        },
        {
          skillId: 42,
          skillName: 'Tên Vũ Trụ',
          description: 'Tên xuyên thủng không gian và thời gian',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 18,
            dungeonName: 'Vực Hỗn Mang Vũ Trụ',
            requiredCompletions: 11,
          },
        ],
        quests: [
          {
            questId: 17,
            questName: 'Thử Thách Xạ Thủ Hỗn Mang',
          },
        ],
        items: [
          {
            itemId: 17,
            itemName: 'Cung Vũ Trụ',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Sát Thủ Vũ Trụ',
      description: 'Sát thủ huyền thoại thao túng không gian và thời gian',
      type: ClassType.ASSASSIN,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        dexterity: 12,
        luck: 12,
        strength: 6,
        intelligence: 4,
        vitality: 1,
      },
      skillUnlocks: [
        {
          skillId: 43,
          skillName: 'Dịch Chuyển Vũ Trụ',
          description: 'Dịch chuyển tức thời qua không gian',
        },
        {
          skillId: 44,
          skillName: 'Ảo Ảnh Vũ Trụ',
          description: 'Tạo ảo ảnh trong nhiều chiều không gian',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 19,
            dungeonName: 'Địa Ngục Vũ Trụ',
            requiredCompletions: 13,
          },
        ],
        quests: [
          {
            questId: 18,
            questName: 'Thử Thách Sát Thủ Vũ Trụ',
          },
        ],
        items: [
          {
            itemId: 18,
            itemName: 'Dao Vũ Trụ',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Thánh Giả Vũ Trụ',
      description: 'Hộ mệnh huyền thoại với sức mạnh vũ trụ bất diệt',
      type: ClassType.TANK,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        vitality: 16,
        strength: 7,
        intelligence: 6,
        luck: 4,
        dexterity: 2,
      },
      skillUnlocks: [
        {
          skillId: 45,
          skillName: 'Khiên Vũ Trụ',
          description: 'Tạo lá chắn bảo vệ từ sức mạnh vũ trụ',
        },
        {
          skillId: 46,
          skillName: 'Sức Mạnh Vũ Trụ',
          description: 'Tăng sức mạnh toàn đội với năng lượng vũ trụ',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 20,
            dungeonName: 'Thiên Đàng Vũ Trụ',
            requiredCompletions: 8,
          },
        ],
        quests: [
          {
            questId: 19,
            questName: 'Thử Thách Thánh Giả Vũ Trụ',
          },
        ],
        items: [
          {
            itemId: 19,
            itemName: 'Giáp Vũ Trụ',
            quantity: 1,
          },
        ],
      },
    },
    {
      name: 'Đạo Sĩ Vũ Trụ',
      description: 'Trị liệu huyền thoại sử dụng sức mạnh vũ trụ để hồi phục',
      type: ClassType.HEALER,
      tier: ClassTier.LEGENDARY,
      requiredLevel: 100,
      statBonuses: {
        intelligence: 13,
        vitality: 9,
        luck: 7,
        dexterity: 4,
        strength: 2,
      },
      skillUnlocks: [
        {
          skillId: 47,
          skillName: 'Hồi Sinh Vũ Trụ',
          description: 'Hồi sinh với sức mạnh vũ trụ',
        },
        {
          skillId: 48,
          skillName: 'Phù Hộ Vũ Trụ',
          description: 'Buff toàn đội với năng lượng vũ trụ vĩnh cửu',
        },
      ],
      advancementRequirements: {
        dungeons: [
          {
            dungeonId: 21,
            dungeonName: 'Đền Vũ Trụ',
            requiredCompletions: 7,
          },
        ],
        quests: [
          {
            questId: 20,
            questName: 'Thử Thách Đạo Sĩ Vũ Trụ',
          },
        ],
        items: [
          {
            itemId: 20,
            itemName: 'Trượng Vũ Trụ',
            quantity: 1,
          },
        ],
      },
    },
  ];

  // First, save basic classes
  for (const classData of basicClasses) {
    const characterClass = characterClassRepository.create(classData);
    await characterClassRepository.save(characterClass);
  }

  // Then save advanced classes with previous class references
  const savedBasicClasses = await characterClassRepository.find({
    where: { tier: ClassTier.BASIC },
  });

  for (const classData of advancedClasses) {
    const previousClass = savedBasicClasses.find(
      (cls) => cls.type === classData.type,
    );
    const classToCreate = {
      ...classData,
      previousClassId: previousClass ? previousClass.id : undefined,
    };
    const characterClass = characterClassRepository.create(classToCreate);
    await characterClassRepository.save(characterClass);
  }

  // Finally save master classes with previous class references
  const savedAdvancedClasses = await characterClassRepository.find({
    where: { tier: ClassTier.ADVANCED },
  });

  for (const classData of masterClasses) {
    const previousClass = savedAdvancedClasses.find(
      (cls) => cls.type === classData.type,
    );
    const classToCreate = {
      ...classData,
      previousClassId: previousClass ? previousClass.id : undefined,
    };
    const characterClass = characterClassRepository.create(classToCreate);
    await characterClassRepository.save(characterClass);
  }

  // Finally save legendary classes with previous class references
  const savedMasterClasses = await characterClassRepository.find({
    where: { tier: ClassTier.MASTER },
  });

  for (const classData of legendaryClasses) {
    const previousClass = savedMasterClasses.find(
      (cls) => cls.type === classData.type,
    );
    const classToCreate = {
      ...classData,
      previousClassId: previousClass ? previousClass.id : undefined,
    };
    const characterClass = characterClassRepository.create(classToCreate);
    await characterClassRepository.save(characterClass);
  }
}
