import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Printer,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MiniCalendar } from './components/MiniCalendar';
import { OccupancyGrid, OccupancyGridSkeleton } from './components/OccupancyGrid';
import { RoomDetailModal } from './components/RoomDetailModal';
import { SubjectSearch } from './components/SubjectSearch';
import type { SubjectOption } from './components/SubjectSearch';
import { ROOM_GROUPS, TIME_SLOTS } from './data/roomGroups';
import type {
  DayTimetableResponse,
  GridDaySchedule,
  RoomDaySchedule,
  RoomGroupId,
} from './data/roomGroups';
import {
  addDays,
  formatFullSpanishDate,
  formatSyncTime,
  getCurrentMadridMinutes,
  getTodayMadridISO,
  getWeekStrip,
} from './utils/dateUtils';

type ActiveSection = 'all' | RoomGroupId;
type RoomFilterMode = 'all' | 'active' | 'free-at-slot';

interface SelectedRoomState {
  room: RoomDaySchedule;
  gridTitle: string;
  slotIndex?: number;
}

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function App() {
  const [todayISO, setTodayISO] = useState<string>(() => getTodayMadridISO());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayMadridISO());
  const [activeSection, setActiveSection] = useState<ActiveSection>('all');

  const [timetable, setTimetable] = useState<DayTimetableResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [onlySubjectRooms, setOnlySubjectRooms] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<RoomFilterMode>('all');
  const [freeSlotIndex, setFreeSlotIndex] = useState<number>(4); // 10:00 default

  const [printTarget, setPrintTarget] = useState<RoomGroupId | 'all' | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoomState | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number>(() => getCurrentMadridMinutes());

  const abortRef = useRef<AbortController | null>(null);

  const fetchDayTimetable = useCallback(
    async (dateISO: string, forceRefresh = false, silent = false) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) {
        if (forceRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }
      setError(null);

      try {
        const params = new URLSearchParams({ date: dateISO });
        if (forceRefresh) params.set('refresh', '1');
        const res = await fetch(`/api/timetable?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : 'Error al cargar los horarios desde WebUntis.'
          );
        }

        setTimetable(data as DayTimetableResponse);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo obtener la información de WebUntis.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchDayTimetable(selectedDate, false, false);
  }, [selectedDate, fetchDayTimetable]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setNowMinutes(getCurrentMadridMinutes());
      const freshToday = getTodayMadridISO();
      if (freshToday !== todayISO) {
        setTodayISO(freshToday);
        setSelectedDate((current) => (current === todayISO ? freshToday : current));
      }
    }, 60 * 1000);

    const syncTimer = window.setInterval(() => {
      fetchDayTimetable(selectedDate, true, true);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(syncTimer);
    };
  }, [selectedDate, todayISO, fetchDayTimetable]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintTarget(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const triggerPrint = useCallback((target: RoomGroupId | 'all') => {
    setPrintTarget(target);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const weekStrip = useMemo(() => getWeekStrip(selectedDate), [selectedDate]);

  const currentSlotIndex = useMemo(() => {
    if (selectedDate !== todayISO) return null;
    if (nowMinutes < 8 * 60 || nowMinutes >= 21 * 60) return null;
    return Math.floor((nowMinutes - 8 * 60) / 30);
  }, [selectedDate, todayISO, nowMinutes]);

  // Extract all unique subjects active on the selected day across all grids
  const availableSubjects: SubjectOption[] = useMemo(() => {
    if (!timetable) return [];
    const map = new Map<
      string,
      { altName: string; rooms: Set<string>; slotsCount: number }
    >();

    // Deduplicate rooms that appear in multiple grids (e.g. P6M7)
    const seenRooms = new Set<string>();

    for (const grid of timetable.grids) {
      for (const room of grid.rooms) {
        if (seenRooms.has(room.name)) continue;
        seenRooms.add(room.name);

        for (const period of room.periods) {
          const subjectKey = period.subject.trim();
          if (!subjectKey) continue;

          let entry = map.get(subjectKey);
          if (!entry) {
            entry = {
              altName: period.subjectAlt || '',
              rooms: new Set<string>(),
              slotsCount: 0,
            };
            map.set(subjectKey, entry);
          }

          entry.rooms.add(room.name);
          const matchingSlots = TIME_SLOTS.filter(
            (slot) => period.startTime < slot.endTime && period.endTime > slot.startTime
          ).length;
          entry.slotsCount += matchingSlots;
        }
      }
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        altName: data.altName,
        rooms: Array.from(data.rooms).sort((a, b) => a.localeCompare(b, 'es')),
        slotsCount: data.slotsCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [timetable]);

  // Daily summary metrics for the clean institutional overview strip
  const dayStats = useMemo(() => {
    if (!timetable) {
      return {
        totalUniqueRooms: 63,
        activeRooms: 0,
        freeAllDayRooms: 0,
        avgOccupancy: 0,
      };
    }
    const seen = new Map<string, RoomDaySchedule>();
    for (const grid of timetable.grids) {
      for (const room of grid.rooms) {
        if (!seen.has(room.name)) {
          seen.set(room.name, room);
        }
      }
    }
    const rooms = Array.from(seen.values());
    const activeRooms = rooms.filter((r) => r.occupiedSlotsCount > 0).length;
    const totalOccSlots = rooms.reduce((sum, r) => sum + r.occupiedSlotsCount, 0);
    const totalSlots = rooms.length * TIME_SLOTS.length;

    return {
      totalUniqueRooms: rooms.length,
      activeRooms,
      freeAllDayRooms: rooms.length - activeRooms,
      avgOccupancy:
        totalSlots > 0 ? Math.round((totalOccSlots / totalSlots) * 100) : 0,
    };
  }, [timetable]);

  const visibleGrids: GridDaySchedule[] = useMemo(() => {
    if (!timetable) return [];
    const normalizedQuery = roomSearchQuery.trim().toLowerCase();

    return timetable.grids
      .filter((grid) => activeSection === 'all' || grid.id === activeSection)
      .map((grid) => {
        const filteredRooms = grid.rooms.filter((room) => {
          if (normalizedQuery) {
            const matchesName = room.name.toLowerCase().includes(normalizedQuery);
            const matchesLong = room.longName.toLowerCase().includes(normalizedQuery);
            if (!matchesName && !matchesLong) {
              return false;
            }
          }

          if (selectedSubject && onlySubjectRooms) {
            const hasSubject = room.periods.some(
              (p) => p.subject === selectedSubject
            );
            if (!hasSubject) return false;
          }

          if (filterMode === 'active') {
            return room.occupiedSlotsCount > 0;
          }

          if (filterMode === 'free-at-slot') {
            return room.slots[freeSlotIndex] === 'free';
          }

          return true;
        });

        const activeRoomsCount = filteredRooms.filter(
          (r) => r.occupiedSlotsCount > 0
        ).length;
        const totalSlots = filteredRooms.length * TIME_SLOTS.length;
        const occSlots = filteredRooms.reduce(
          (sum, r) => sum + r.occupiedSlotsCount,
          0
        );

        return {
          ...grid,
          rooms: filteredRooms,
          activeRoomsCount,
          occupancyPercent:
            totalSlots > 0 ? Math.round((occSlots / totalSlots) * 100) : 0,
        };
      });
  }, [
    timetable,
    activeSection,
    roomSearchQuery,
    selectedSubject,
    onlySubjectRooms,
    filterMode,
    freeSlotIndex,
  ]);

  const selectedSubjectMeta = useMemo(
    () => availableSubjects.find((s) => s.name === selectedSubject) ?? null,
    [availableSubjects, selectedSubject]
  );

  const webUntisDirectUrl =
    timetable?.webUntisUrl ??
    `https://ehu.webuntis.com/WebUntis/?date=${encodeURIComponent(selectedDate)}#/basic/timetablePublic`;

  const hasRoomFilters =
    roomSearchQuery.trim().length > 0 || filterMode !== 'all';

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 flex flex-col">
      {/* Top Bar Contract: 1 row, 3 clean zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('all');
            }}
            className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            EIB 306 · Horarios de Aulas
          </a>

          <nav
            aria-label="Cuadrículas del centro"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {(
              [
                { id: 'all', label: 'Todas las cuadrículas' },
                { id: 'modulo-m', label: 'Módulo M' },
                { id: 'modulo-i', label: 'Módulo I' },
                { id: 'especiales', label: 'Salas Especiales' },
              ] as const
            ).map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={[
                    'py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isActive
                      ? 'border-red-500 text-white'
                      : 'border-transparent text-slate-300 hover:text-white hover:border-slate-600',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              disabled={loading || !timetable}
              onClick={() =>
                triggerPrint(activeSection === 'all' ? 'all' : activeSection)
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              <Printer className="w-3.5 h-3.5" />
              {activeSection === 'all' ? 'Imprimir todo' : 'Imprimir vista'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div
        id="top"
        className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 items-start"
      >
        {/* Left Navigation, Calendar & Filters Sidebar */}
        <aside className="no-print w-full lg:w-[288px] shrink-0 space-y-4 lg:sticky lg:top-20">
          <MiniCalendar
            selectedDate={selectedDate}
            todayISO={todayISO}
            onSelectDate={(iso) => setSelectedDate(iso)}
          />

          {/* Dedicated Subject Search & Green Highlight Control */}
          <SubjectSearch
            subjects={availableSubjects}
            selectedSubject={selectedSubject}
            onlyMatchingRooms={onlySubjectRooms}
            onSelectSubject={(name) => {
              setSelectedSubject(name);
              if (!name) setOnlySubjectRooms(false);
            }}
            onToggleOnlyMatchingRooms={setOnlySubjectRooms}
          />

          {/* Room Search & Availability Filter Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div>
              <label
                htmlFor="room-search-input"
                className="block text-xs font-semibold text-slate-900 mb-1.5"
              >
                Filtrar por aula
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="room-search-input"
                  type="text"
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  placeholder="Ej. P3M2A, P4I6A, Magna..."
                  className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-2 focus:outline-red-600"
                />
                {roomSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRoomSearchQuery('')}
                    aria-label="Limpiar búsqueda de aula"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-900 mb-1.5">
                Disponibilidad
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'active', label: 'Ocupadas' },
                    { id: 'free-at-slot', label: 'Libres' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFilterMode(mode.id)}
                    className={[
                      'py-1.5 px-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer',
                      filterMode === mode.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900',
                    ].join(' ')}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {filterMode === 'free-at-slot' && (
              <div>
                <label
                  htmlFor="free-slot-select"
                  className="block text-xs text-slate-600 mb-1"
                >
                  Franja horaria libre
                </label>
                <select
                  id="free-slot-select"
                  value={freeSlotIndex}
                  onChange={(e) => setFreeSlotIndex(Number(e.target.value))}
                  className="w-full text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 text-slate-900 focus:bg-white focus:outline-2 focus:outline-emerald-600"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.index} value={slot.index}>
                      {slot.label} –{' '}
                      {String(Math.floor(slot.endTime / 100)).padStart(2, '0')}:
                      {String(slot.endTime % 100).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasRoomFilters && (
              <button
                type="button"
                onClick={() => {
                  setRoomSearchQuery('');
                  setFilterMode('all');
                }}
                className="w-full py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Restablecer filtros de aula
              </button>
            )}
          </div>

          {/* WebUntis Sync & Official Source Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Escuela de Ingeniería de Bilbao
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Centro 306</span>
                <span aria-hidden="true">·</span>
                <span>UPV/EHU</span>
                {timetable && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Act. {formatSyncTime(timetable.lastUpdated)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={refreshing || loading}
                onClick={() => fetchDayTimetable(selectedDate, true, false)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                />
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </button>

              <a
                href={webUntisDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                WebUntis
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </aside>

        {/* Main Grids Viewport */}
        <main className="min-w-0 flex-1 w-full space-y-5">
          {/* Mobile Section Tabs */}
          <div className="no-print md:hidden flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'modulo-m', label: 'Módulo M' },
                { id: 'modulo-i', label: 'Módulo I' },
                { id: 'especiales', label: 'Especiales' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={[
                  'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                  activeSection === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Institutional Date Control & Summary Header */}
          <div className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  aria-label="Día anterior"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                    {formatFullSpanishDate(selectedDate)}
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Centro 306 · Escuela de Ingeniería de Bilbao</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">08:00 – 21:00</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  aria-label="Día siguiente"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Clean Color Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-white border border-slate-300 inline-block" />
                  Libre
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-red-600 border border-red-700 inline-block" />
                  Ocupada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-red-800 border border-red-900 inline-block" />
                  Examen
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-emerald-600 border border-emerald-700 inline-block" />
                  Asignatura
                </span>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70">
              <div className="px-5 py-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Aulas monitorizadas
                </p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900">
                  {dayStats.totalUniqueRooms}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Con actividad hoy
                </p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-red-700">
                  {loading ? '—' : dayStats.activeRooms}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Libres toda la jornada
                </p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900">
                  {loading ? '—' : dayStats.freeAllDayRooms}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Ocupación media diaria
                </p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900">
                  {loading ? '—' : `${dayStats.avgOccupancy}%`}
                </p>
              </div>
            </div>

            {/* Instant 1-Click Weekday Strip */}
            <div className="px-5 py-2.5 border-t border-slate-200 bg-white flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {weekStrip.map((day) => {
                  const isSelected = day.iso === selectedDate;
                  const isToday = day.iso === todayISO;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => setSelectedDate(day.iso)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer',
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : isToday
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      ].join(' ')}
                    >
                      <span>{day.shortLabel}</span>
                      <span className="font-mono tabular-nums">{day.dayNumber}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDays(d, -7))}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  −1 sem.
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayISO)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => addDays(d, 7))}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  +1 sem.
                </button>
              </div>
            </div>
          </div>

          {/* Active Subject Highlight Bar */}
          {selectedSubject && (
            <div className="no-print bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-800">
                  <span className="w-3 h-3 bg-emerald-600 inline-block shrink-0" />
                  <span className="font-semibold text-emerald-950">
                    {selectedSubject}
                  </span>
                  {selectedSubjectMeta ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {selectedSubjectMeta.rooms.length}{' '}
                        {selectedSubjectMeta.rooms.length === 1 ? 'aula' : 'aulas'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedSubjectMeta.rooms.join(', ')}</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Sin horario registrado en esta fecha</span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(null);
                  setOnlySubjectRooms(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Quitar selección
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="no-print bg-white border border-red-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Error de sincronización con WebUntis
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchDayTimetable(selectedDate, true, false)}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Occupancy Grids or Loading Skeletons */}
          {loading ? (
            <div className="space-y-5">
              {ROOM_GROUPS.filter(
                (g) => activeSection === 'all' || g.id === activeSection
              ).map((g) => (
                <OccupancyGridSkeleton
                  key={g.id}
                  title={g.title}
                  subtitle={g.subtitle}
                  rowCount={g.rooms.length}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {visibleGrids.map((grid) => (
                <OccupancyGrid
                  key={grid.id}
                  grid={grid}
                  dateISO={timetable?.date ?? selectedDate}
                  highlightedSlotIndex={
                    filterMode === 'free-at-slot' ? freeSlotIndex : null
                  }
                  currentSlotIndex={currentSlotIndex}
                  selectedSubject={selectedSubject}
                  printTarget={printTarget}
                  onPrintGrid={triggerPrint}
                  onSelectRoom={(room, gridTitle, slotIndex) =>
                    setSelectedRoom({ room, gridTitle, slotIndex })
                  }
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Room Detail Modal */}
      <RoomDetailModal
        room={selectedRoom?.room ?? null}
        gridTitle={selectedRoom?.gridTitle ?? ''}
        dateISO={timetable?.date ?? selectedDate}
        webUntisUrl={webUntisDirectUrl}
        selectedSubject={selectedSubject}
        initialSlotIndex={selectedRoom?.slotIndex}
        onSelectSubject={(name) => {
          setSelectedSubject(name);
          if (!name) setOnlySubjectRooms(false);
        }}
        onClose={() => setSelectedRoom(null)}
      />
    </div>
  );
}
