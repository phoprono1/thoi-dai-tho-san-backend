/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PvpMatch,
  PvpPlayer,
  PvpMatchStatus,
  PvpMatchType,
  PvpTeam,
} from './pvp.entity';
import { User } from '../users/user.entity';
import { CombatResultsService } from '../combat-results/combat-results.service';

@Injectable()
export class PvpService {
  constructor(
    @InjectRepository(PvpMatch)
    private pvpMatchRepository: Repository<PvpMatch>,
    @InjectRepository(PvpPlayer)
    private pvpPlayerRepository: Repository<PvpPlayer>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private combatResultsService: CombatResultsService,
  ) {}

  // Tạo trận đấu PVP mới
  async createMatch(
    userId: number,
    matchType: PvpMatchType,
  ): Promise<PvpMatch> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người chơi không tồn tại');
    }

    // Xác định số lượng người chơi tối đa cho mỗi đội
    let maxPlayersPerTeam = 1;
    switch (matchType) {
      case PvpMatchType.ONE_VS_ONE:
        maxPlayersPerTeam = 1;
        break;
      case PvpMatchType.FIVE_VS_FIVE:
        maxPlayersPerTeam = 5;
        break;
      case PvpMatchType.TEN_VS_TEN:
        maxPlayersPerTeam = 10;
        break;
    }

    const match = this.pvpMatchRepository.create({
      matchType,
      maxPlayersPerTeam,
      status: PvpMatchStatus.WAITING,
    });

    const savedMatch = await this.pvpMatchRepository.save(match);

    // Tự động thêm người tạo vào đội A
    await this.joinMatch(savedMatch.id, userId, PvpTeam.TEAM_A);

    return savedMatch;
  }

  // Tham gia trận đấu
  async joinMatch(
    matchId: number,
    userId: number,
    team: PvpTeam,
  ): Promise<PvpPlayer> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    if (match.status !== PvpMatchStatus.WAITING) {
      throw new BadRequestException('Trận đấu đã bắt đầu hoặc kết thúc');
    }

    // Kiểm tra người chơi đã tham gia chưa
    const existingPlayer = match.players.find((p) => p.userId === userId);
    if (existingPlayer) {
      throw new BadRequestException('Bạn đã tham gia trận đấu này rồi');
    }

    // Kiểm tra số lượng người chơi trong đội
    const teamPlayers = match.players.filter((p) => p.team === team);
    if (teamPlayers.length >= match.maxPlayersPerTeam) {
      throw new BadRequestException(
        `Đội ${team} đã đầy (${match.maxPlayersPerTeam} người)`,
      );
    }

    const player = this.pvpPlayerRepository.create({
      matchId,
      userId,
      team,
    });

    const savedPlayer = await this.pvpPlayerRepository.save(player);

    // Cập nhật số lượng người chơi trong đội
    if (team === PvpTeam.TEAM_A) {
      match.currentPlayersTeamA++;
    } else {
      match.currentPlayersTeamB++;
    }
    await this.pvpMatchRepository.save(match);

    return savedPlayer;
  }

  // Rời khỏi trận đấu
  async leaveMatch(matchId: number, userId: number): Promise<void> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    if (match.status !== PvpMatchStatus.WAITING) {
      throw new BadRequestException('Không thể rời khỏi trận đấu đã bắt đầu');
    }

    const player = match.players.find((p) => p.userId === userId);
    if (!player) {
      throw new NotFoundException('Bạn chưa tham gia trận đấu này');
    }

    await this.pvpPlayerRepository.delete(player.id);

    // Cập nhật số lượng người chơi
    if (player.team === PvpTeam.TEAM_A) {
      match.currentPlayersTeamA--;
    } else {
      match.currentPlayersTeamB--;
    }
    await this.pvpMatchRepository.save(match);
  }

  // Bắt đầu trận đấu
  async startMatch(matchId: number, userId: number): Promise<PvpMatch> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players', 'players.user'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    if (match.status !== PvpMatchStatus.WAITING) {
      throw new BadRequestException('Trận đấu đã bắt đầu hoặc kết thúc');
    }

    // Kiểm tra quyền bắt đầu (chỉ người tạo mới được bắt đầu)
    const isCreator = match.players.some(
      (p) => p.userId === userId && p.team === PvpTeam.TEAM_A,
    );
    if (!isCreator) {
      throw new BadRequestException(
        'Chỉ người tạo trận đấu mới có thể bắt đầu',
      );
    }

    // Kiểm tra đủ người chơi
    if (
      match.currentPlayersTeamA < match.maxPlayersPerTeam ||
      match.currentPlayersTeamB < match.maxPlayersPerTeam
    ) {
      throw new BadRequestException(
        'Cần đủ người chơi ở cả hai đội để bắt đầu trận đấu',
      );
    }

    match.status = PvpMatchStatus.IN_PROGRESS;
    return await this.pvpMatchRepository.save(match);
  }

  // Kết thúc trận đấu
  async endMatch(matchId: number, winnerTeam: PvpTeam): Promise<PvpMatch> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players', 'players.user'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    if (match.status !== PvpMatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Trận đấu chưa bắt đầu hoặc đã kết thúc');
    }

    match.status = PvpMatchStatus.COMPLETED;
    match.winnerTeam = winnerTeam;

    // Tính điểm cho đội thắng
    if (winnerTeam === PvpTeam.TEAM_A) {
      match.teamAScore = 1;
    } else {
      match.teamBScore = 1;
    }

    return await this.pvpMatchRepository.save(match);
  }

  // Lấy danh sách trận đấu đang chờ
  async getWaitingMatches(): Promise<PvpMatch[]> {
    return await this.pvpMatchRepository.find({
      where: { status: PvpMatchStatus.WAITING },
      relations: ['players', 'players.user'],
      order: { createdAt: 'DESC' },
    });
  }

  // Lấy chi tiết trận đấu
  async getMatch(matchId: number): Promise<PvpMatch> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players', 'players.user'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    return match;
  }

  // Lấy trận đấu của người chơi
  async getUserMatches(userId: number): Promise<PvpMatch[]> {
    const playerMatches = await this.pvpPlayerRepository.find({
      where: { userId },
      relations: ['match', 'match.players', 'match.players.user'],
    });

    return playerMatches.map((pm) => pm.match);
  }

  // Hủy trận đấu
  async cancelMatch(matchId: number, userId: number): Promise<void> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players'],
    });

    if (!match) {
      throw new NotFoundException('Trận đấu không tồn tại');
    }

    if (match.status !== PvpMatchStatus.WAITING) {
      throw new BadRequestException('Chỉ có thể hủy trận đấu đang chờ');
    }

    // Kiểm tra quyền hủy (chỉ người tạo mới được hủy)
    const isCreator = match.players.some(
      (p) => p.userId === userId && p.team === PvpTeam.TEAM_A,
    );
    if (!isCreator) {
      throw new BadRequestException('Chỉ người tạo trận đấu mới có thể hủy');
    }

    match.status = PvpMatchStatus.CANCELLED;
    await this.pvpMatchRepository.save(match);
  }

  // Cập nhật trạng thái sẵn sàng của người chơi
  async setPlayerReady(
    matchId: number,
    userId: number,
    isReady: boolean,
  ): Promise<PvpPlayer> {
    const player = await this.pvpPlayerRepository.findOne({
      where: { matchId, userId },
    });

    if (!player) {
      throw new NotFoundException('Người chơi không tham gia trận đấu này');
    }

    player.isReady = isReady;
    return await this.pvpPlayerRepository.save(player);
  }

  // Tính toán kết quả trận đấu (tương tự PVE)
  async calculateMatchResult(matchId: number): Promise<any> {
    const match = await this.pvpMatchRepository.findOne({
      where: { id: matchId },
      relations: ['players', 'players.user'],
    });

    if (!match || match.status !== PvpMatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Trận đấu không hợp lệ');
    }

    const teamAPlayers = match.players.filter((p) => p.team === PvpTeam.TEAM_A);
    const teamBPlayers = match.players.filter((p) => p.team === PvpTeam.TEAM_B);

    // Tính toán damage và stats cho từng đội
    const teamAStats = await this.calculateTeamStats(teamAPlayers);
    const teamBStats = await this.calculateTeamStats(teamBPlayers);

    // Xác định đội thắng dựa trên tổng damage
    const winnerTeam =
      teamAStats.totalDamage > teamBStats.totalDamage
        ? PvpTeam.TEAM_A
        : PvpTeam.TEAM_B;

    const result = {
      winnerTeam,
      teamAStats,
      teamBStats,
      matchDuration: Date.now() - match.createdAt.getTime(),
    };

    match.matchResult = result;
    await this.pvpMatchRepository.save(match);

    return result;
  }

  private calculateTeamStats(players: PvpPlayer[]): any {
    let totalDamage = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;

    for (const player of players) {
      totalDamage += player.damageDealt;
      totalKills += player.kills;
      totalDeaths += player.deaths;
      totalAssists += player.assists;
    }

    return {
      totalDamage,
      totalKills,
      totalDeaths,
      totalAssists,
      playerCount: players.length,
      players: players.map((p) => ({
        userId: p.userId,
        damage: p.damageDealt,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
      })),
    };
  }
}
