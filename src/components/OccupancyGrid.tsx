import { Printer } from 'lucide-react';
import {
  CENTER_CODE,
  CENTER_NAME,
  TIME_SLOTS,
} from '../data/roomGroups';
import type {
  GridDaySchedule,
  PeriodDetail,
  RoomDaySchedule,
  RoomGroupId,
} from '../data/roomGroups';
import { formatWebUntisDayHeader } from '../utils/dateUtils';

interface OccupancyGridProps {
  grid: GridDaySchedule;
  dateISO: string;
  highlightedSlotIndex: number | null;
  currentSlotIndex: number | null;
  selectedSubject: string | null;
  printTarget: RoomGroupId | 'all' | null;
  onPrintGrid: (gridId: RoomGroupId) => void;
  onSelectRoom: (room: RoomDaySchedule, gridTitle: string, slotIndex?: number) => void;
}

function slotMatchesSubject(
  room: RoomDaySchedule,
  slotIndex: number,
  selectedSubject: string | null
): boolean {
  if (!selectedSubject) return false;
  const slot = TIME_SLOTS[slotIndex];
  return room.periods.some(
    (p) =>
      p.subject === selectedSubject &&
      p.startTime < slot.endTime &&
      p.endTime > slot.startTime
  );
}

function getSlotTooltip(
  room: RoomDaySchedule,
  slotIndex: number,
  isSubjectMatch: boolean
): string {
  const slot = TIME_SLOTS[slotIndex];
  const matching = room.periods.filter(
    (p) => p.startTime < slot.endTime && p.endTime > slot.startTime
  );
  if (matching.length === 0) {
    return `${room.name} · ${slot.label} · Libre`;
  }
  const summary = matching
    .map((p: PeriodDetail) => {
      const parts = [p.subject];
      if (p.lessonText && p.lessonText !== p.subject) parts.push(`(${p.lessonText})`);
      if (p.groups.length > 0) parts.push(`· ${p.groups.slice(0, 2).join(', ')}`);
      return `${p.startLabel}–${p.endLabel} ${parts.join(' ')}`;
    })
    .join(' | ');
  return `${room.name}${isSubjectMatch ? ' [Asignatura seleccionada]' : ''} · ${summary}`;
}

export function OccupancyGrid({
  grid,
  dateISO,
  highlightedSlotIndex,
  currentSlotIndex,
  selectedSubject,
  printTarget,
  onPrintGrid,
  onSelectRoom,
}: OccupancyGridProps) {
  const dayHeader = formatWebUntisDayHeader(dateISO);
  const isHiddenInPrint =
    printTarget !== null && printTarget !== 'all' && printTarget !== grid.id;
  const shouldBreakAfter = printTarget === 'all';

  const subjectRoomsInGrid = selectedSubject
    ? grid.rooms.filter((r) =>
        r.periods.some((p) => p.subject === selectedSubject)
      ).length
    : 0;

  return (
    <section
      id={`grid-${grid.id}`}
      aria-label={grid.title}
      className={[
        'print-grid-section bg-white border border-slate-200 rounded-xl overflow-hidden',
        shouldBreakAfter ? 'print-page-break' : '',
        isHiddenInPrint ? 'print-hidden-target' : '',
      ].join(' ')}
    >
      {/* Print-only clean institutional header */}
      <div className="hidden print-only mb-2 pb-1.5 border-b border-slate-400">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-sm font-bold text-slate-900">
              {CENTER_NAME} (Centro {CENTER_CODE})
            </span>
            <span className="text-xs text-slate-600 ml-3">{grid.title}</span>
            {selectedSubject && (
              <span className="text-xs font-semibold text-emerald-700 ml-3">
                · Asignatura: {selectedSubject}
              </span>
            )}
          </div>
          <span className="text-xs font-mono font-semibold text-slate-900">
            {dayHeader} · {grid.rooms.length} aulas
          </span>
        </div>
      </div>

      {/* Screen Header */}
      <div className="no-print px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-white to-slate-50/60">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">
              {grid.title}
            </h2>
            {selectedSubject && subjectRoomsInGrid > 0 && (
              <span className="text-xs font-medium text-emerald-700 font-mono tabular-nums">
                {subjectRoomsInGrid}{' '}
                {subjectRoomsInGrid === 1
                  ? 'aula con la asignatura'
                  : 'aulas con la asignatura'}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{grid.subtitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700">
              {grid.rooms.length} aulas
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {grid.activeRoomsCount} con actividad
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-red-700 font-medium">
              {grid.occupancyPercent}% ocupación
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPrintGrid(grid.id)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          Imprimir cuadrícula
        </button>
      </div>

      {/* Matrix Grid */}
      {grid.rooms.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          Ninguna aula de esta cuadrícula coincide con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="occupancy-table w-full border-collapse min-w-[820px] table-fixed">
            <colgroup>
              <col className="w-[182px] print:w-[148px]" />
              {TIME_SLOTS.map((slot) => (
                <col key={slot.index} />
              ))}
            </colgroup>

            <thead>
              {/* Row 1: "Aulas" + Date Banner matching Screenshot 4 ("Lu, 23.11. 2026") */}
              <tr className="bg-slate-100/80">
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-700 align-middle"
                >
                  Aulas
                </th>
                <th
                  colSpan={TIME_SLOTS.length}
                  scope="colgroup"
                  className="border-b border-slate-300 py-1.5 text-center text-xs font-semibold font-mono tabular-nums text-slate-800 bg-slate-100/80"
                >
                  {dayHeader}
                </th>
              </tr>

              {/* Row 2: 26 two-line 30-min headers (08/00 .. 20/30) */}
              <tr className="bg-white">
                {TIME_SLOTS.map((slot) => {
                  const isHighlighted = highlightedSlotIndex === slot.index;
                  const isCurrent = currentSlotIndex === slot.index;
                  return (
                    <th
                      key={slot.index}
                      scope="col"
                      className={[
                        'border-b border-r border-slate-300 last:border-r-0 py-1 px-0 text-center font-mono tabular-nums text-[10px] leading-[1.15] font-medium select-none',
                        isHighlighted
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : isCurrent
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'text-slate-600',
                      ].join(' ')}
                    >
                      <div>{slot.hour}</div>
                      <div>{slot.minute}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {grid.rooms.map((room) => {
                const roomHasSelectedSubject =
                  selectedSubject !== null &&
                  room.periods.some((p) => p.subject === selectedSubject);

                return (
                  <tr
                    key={`${grid.id}-${room.name}`}
                    className={[
                      'group transition-colors',
                      roomHasSelectedSubject
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <th
                      scope="row"
                      className={[
                        'sticky left-0 z-10 border-b border-r border-slate-300 px-2.5 py-1 text-left font-normal transition-colors',
                        roomHasSelectedSubject
                          ? 'bg-emerald-50/90 group-hover:bg-emerald-50'
                          : 'bg-white group-hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectRoom(room, grid.title)}
                        title={`${room.longName} — Pulsa para ver el detalle diario`}
                        className={[
                          'w-full text-left text-[12px] leading-tight font-medium hover:underline truncate block cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600',
                          roomHasSelectedSubject
                            ? 'text-emerald-800 font-semibold'
                            : 'text-slate-800 hover:text-red-700',
                        ].join(' ')}
                      >
                        {room.name}
                      </button>
                    </th>

                    {room.slots.map((slotState, slotIndex) => {
                      const isSubjectMatch = slotMatchesSubject(
                        room,
                        slotIndex,
                        selectedSubject
                      );
                      const isOccupied = slotState === 'occupied';
                      const isExam = slotState === 'exam';
                      const isHighlighted = highlightedSlotIndex === slotIndex;
                      const isCurrent = currentSlotIndex === slotIndex;

                      const cellColorClass = isSubjectMatch
                        ? 'occupancy-cell-subject bg-emerald-600'
                        : isExam
                          ? selectedSubject
                            ? 'occupancy-cell-exam bg-red-800/75'
                            : 'occupancy-cell-exam bg-red-800'
                          : isOccupied
                            ? selectedSubject
                              ? 'occupancy-cell-occupied bg-red-600/70'
                              : 'occupancy-cell-occupied bg-red-600'
                            : isHighlighted
                              ? 'bg-emerald-50/70'
                              : 'bg-white';

                      return (
                        <td
                          key={slotIndex}
                          className={[
                            'border-b border-r border-slate-300 last:border-r-0 p-0 h-[25px] print:h-[19px] relative transition-colors',
                            cellColorClass,
                            isCurrent
                              ? 'ring-1 ring-inset ring-slate-900/70'
                              : '',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onSelectRoom(room, grid.title, slotIndex)
                            }
                            title={getSlotTooltip(room, slotIndex, isSubjectMatch)}
                            aria-label={getSlotTooltip(
                              room,
                              slotIndex,
                              isSubjectMatch
                            )}
                            className={[
                              'w-full h-full block cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-slate-900 focus-visible:z-10',
                              isSubjectMatch
                                ? 'hover:bg-emerald-700/40'
                                : isOccupied || isExam
                                  ? 'hover:bg-red-950/25'
                                  : 'hover:bg-slate-200/60',
                            ].join(' ')}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface OccupancyGridSkeletonProps {
  title: string;
  subtitle: string;
  rowCount: number;
}

export function OccupancyGridSkeleton({
  title,
  subtitle,
  rowCount,
}: OccupancyGridSkeletonProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="h-8 w-36 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="p-4 space-y-1.5">
        <div className="h-8 bg-slate-100 rounded animate-pulse" />
        {Array.from({ length: Math.min(rowCount, 10) }).map((_, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="h-[25px] w-[176px] bg-slate-100 rounded-sm animate-pulse shrink-0" />
            <div className="h-[25px] flex-1 bg-slate-50 rounded-sm animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
