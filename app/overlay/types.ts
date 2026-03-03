export interface SessionSummaryDto {
  weapon_set: string;
  is_best_of_n: boolean;
  start_time: string | null;
  duration_seconds: number;
  total_fights: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  avg_damage: number;
  rating: number;
}

export interface PlayerDto {
  nickname: string;
  team: string | number | null;
  is_bot: boolean;
  power_score: number;
  kills: number;
  deaths: number;
  damage_dealt: number;
  damage_received: number;
  score: number;
  weapons_def: string[];
  weapons: string[];
  // Строка вида "Тошнитель(556), Обрез(5465), Циркулярка(444), Таран(879)"
  weapons_with_damage?: string;
  is_tower?: boolean;
  is_leviathan?: boolean;
  is_self: boolean;
  placement?: number;
  damage_to_players?: Record<string, number>;
}

export interface FightDto {
  map: string;
  map_tech: string;
  mode: string;
  mode_tech: string;
  is_win: boolean | null;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  duration: number;
  end_time: string;
  start_time: string;
  is_bon_match: boolean;
  mvp: boolean;
  half_mvp: boolean;
  is_ffa: boolean;
  winner_team: string | number | null;
  players: PlayerDto[];
}

export interface SessionResponseDto {
  schema: 1;
  channel_id: string;
  nickname: string;
  session: SessionSummaryDto;
  fights: FightDto[];
  rating_tabs?: RatingTabDto[];
}

export interface RatingPlayerRowDto {
  nickname: string;
  place: number;
  rating: number;
  games: number;
  kills: number;
  deaths: number;
  kd: number;
  avg_damage: number;
  avg_score: number;
  mvp: number;
  wins: number;
  losses: number;
  wr_percent: number;
}

export interface RatingWeaponRowDto {
  name: string;
  users: number;
  wr_percent: number;
  avg_damage: number;
  avg_kills: number;
}

export interface RatingTabDto {
  id: string;
  name: string;
  is_custom: boolean;
  players: RatingPlayerRowDto[];
  weapons: RatingWeaponRowDto[];
}

