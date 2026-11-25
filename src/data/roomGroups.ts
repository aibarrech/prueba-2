export interface TimeSlot {
  index: number;
  startTime: number; // e.g. 800, 830, ..., 2030
  endTime: number;   // e.g. 830, 900, ..., 2100
  hour: string;      // "08" .. "20"
  minute: string;    // "00" | "30"
  label: string;     // "08:00" .. "20:30"
}

export const TIME_SLOTS: TimeSlot[] = Array.from({ length: 26 }, (_, index) => {
  const totalStartMinutes = 8 * 60 + index * 30;
  const totalEndMinutes = totalStartMinutes + 30;
  const startH = Math.floor(totalStartMinutes / 60);
  const startM = totalStartMinutes % 60;
  const endH = Math.floor(totalEndMinutes / 60);
  const endM = totalEndMinutes % 60;

  const hour = String(startH).padStart(2, '0');
  const minute = String(startM).padStart(2, '0');

  return {
    index,
    startTime: startH * 100 + startM,
    endTime: endH * 100 + endM,
    hour,
    minute,
    label: `${hour}:${minute}`,
  };
});

export type RoomGroupId = 'modulo-m' | 'modulo-i' | 'especiales';

export interface RoomGroupDef {
  id: RoomGroupId;
  shortLabel: string;
  title: string;
  subtitle: string;
  rooms: string[];
}

export const CENTER_CODE = '306';
export const CENTER_NAME = 'Escuela de Ingeniería de Bilbao';
export const DEPARTMENT_ID = 238; // Bilboko Ingeniaritza Eskola / Escuela Ingenieria de Bilbao
export const DEFAULT_FORMAT_ID = 5; // 306-Euiti Bilbao

export const ROOM_GROUPS: RoomGroupDef[] = [
  {
    id: 'modulo-m',
    shortLabel: 'Módulo M',
    title: 'Edificio II · Módulo M',
    subtitle: 'Aulas y seminarios B63 · Plantas P2 a P6',
    rooms: [
      'P2M1A_B63',
      'P2M2A_B63',
      'P2M3A_B63',
      'P2M4A_B63',
      'P3M1A_B63',
      'P3M2A_B63',
      'P3M3A_B63',
      'P3M4A_B63',
      'P4M15S_B63',
      'P4M1A_B63',
      'P4M2A_B63',
      'P4M3A_B63',
      'P4M4A_B63',
      'P5M1A_B63',
      'P5M2A_B63',
      'P5M3A_B63',
      'P5M4A_B63',
      'P6M3I_B63',
      'P6M7',
    ],
  },
  {
    id: 'modulo-i',
    shortLabel: 'Módulo I',
    title: 'Edificio II · Módulo I',
    subtitle: 'Aulas, seminarios y laboratorios B63 · Plantas P2 a P8',
    rooms: [
      'P2I23S_B63',
      'P2I25S_B63',
      'P2I4A_B63',
      'P2I5A_B63',
      'P3I10A_B63',
      'P3I12A_B63',
      'P3I13A_B63',
      'P3I2A_B63',
      'P3I3A_B63',
      'P3I4A_B63',
      'P3I6A_B63',
      'P3I7A_B63',
      'P3I9A_B63',
      'P4I10A_B63',
      'P4I12A_B63',
      'P4I1S_B63',
      'P4I2A_B63',
      'P4I4L_B63',
      'P4I5A_B63',
      'P4I6A_B63',
      'P4I9A_B63',
      'P5I26S_B63',
      'P5I27S_B63',
      'P5I2A_B63',
      'P5I4L_B63',
      'P5I5A_B63',
      'P5I8A_B63',
      'P5I9A_B63',
      'P6I9A_B63',
      'P7I5A_B63',
      'P7I8A_B63',
      'P7I9A_B63',
      'P8I7L_B63',
    ],
  },
  {
    id: 'especiales',
    shortLabel: 'Salas Especiales',
    title: 'Salas Especiales y Actos',
    subtitle: 'Aulas Magnas, Salones de Actos, Grados y Juntas',
    rooms: [
      'P0E1 S.CONFER Edif I',
      'P0I1 A.MAGNA Edif II',
      'P0M2 A.MAGNA Edif II',
      'P0P1 S.ACTOS Edif.P',
      'P1A1 A.GRADOS Edif I',
      'P1I15 JUNTAS Edif II',
      'P1I1 S.GRADOS II-I',
      'P1M1 JUNTAS Edif II',
      'P1P18 S.GRADOS Ed.P',
      'P1P1 S. JUNTAS Ed.P',
      'P6M7',
      'P6P1 Puente alto',
    ],
  },
];

export const ALL_UNIQUE_ROOM_NAMES: string[] = Array.from(
  new Set(ROOM_GROUPS.flatMap((group) => group.rooms))
);

export type SlotState = 'free' | 'occupied' | 'exam';

export interface PeriodDetail {
  id: number;
  startTime: number;
  endTime: number;
  startLabel: string;
  endLabel: string;
  cellState: string;
  subject: string;
  subjectAlt: string;
  groups: string[];
  teachers: string[];
  lessonText: string;
  periodText: string;
  substText: string;
  isExam: boolean;
}

export interface RoomDaySchedule {
  name: string;
  longName: string;
  elementId: number | null;
  capacity: number;
  slots: SlotState[]; // 26 entries matching TIME_SLOTS
  periods: PeriodDetail[];
  occupiedSlotsCount: number;
}

export interface GridDaySchedule {
  id: RoomGroupId;
  shortLabel: string;
  title: string;
  subtitle: string;
  rooms: RoomDaySchedule[];
  activeRoomsCount: number;
  occupancyPercent: number;
}

export interface DayTimetableResponse {
  date: string; // YYYY-MM-DD
  weekKey: string; // Monday YYYY-MM-DD
  centerCode: string;
  centerName: string;
  webUntisUrl: string;
  lastUpdated: string; // ISO timestamp
  cached: boolean;
  grids: GridDaySchedule[];
}
