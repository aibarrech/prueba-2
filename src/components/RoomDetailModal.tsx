import { Clock, ExternalLink, Highlighter, X } from 'lucide-react';
import { useEffect } from 'react';
import { TIME_SLOTS } from '../data/roomGroups';
import type { RoomDaySchedule } from '../data/roomGroups';
import { formatFullSpanishDate } from '../utils/dateUtils';

interface RoomDetailModalProps {
  room: RoomDaySchedule | null;
  gridTitle: string;
  dateISO: string;
  webUntisUrl: string;
  selectedSubject: string | null;
  initialSlotIndex?: number;
  onSelectSubject: (subjectName: string | null) => void;
  onClose: () => void;
}

export function RoomDetailModal({
  room,
  gridTitle,
  dateISO,
  webUntisUrl,
  selectedSubject,
  initialSlotIndex,
  onSelectSubject,
  onClose,
}: RoomDetailModalProps) {
  useEffect(() => {
    if (!room) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [room, onClose]);

  if (!room) return null;

  const totalHours = (room.occupiedSlotsCount * 0.5).toFixed(1).replace('.0', '');
  const selectedSlot =
    initialSlotIndex !== undefined ? TIME_SLOTS[initialSlotIndex] : undefined;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-detail-title"
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3
              id="room-detail-title"
              className="text-lg font-semibold text-slate-900 truncate"
            >
              {room.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{room.longName !== room.name ? room.longName : gridTitle}</span>
              <span aria-hidden="true">·</span>
              <span>{formatFullSpanishDate(dateISO)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-red-700 font-medium">
                {totalHours} h ocupadas
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del aula"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual 08:00-21:00 Timeline Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 mb-1.5">
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:30</span>
          </div>
          <div className="grid grid-cols-[repeat(26,minmax(0,1fr))] border border-slate-300 bg-white h-5">
            {room.slots.map((state, idx) => {
              const slot = TIME_SLOTS[idx];
              const isSubjectMatch =
                selectedSubject !== null &&
                room.periods.some(
                  (p) =>
                    p.subject === selectedSubject &&
                    p.startTime < slot.endTime &&
                    p.endTime > slot.startTime
                );

              return (
                <div
                  key={idx}
                  title={`${slot.label} · ${
                    isSubjectMatch
                      ? `${selectedSubject} (seleccionada)`
                      : state === 'free'
                        ? 'Libre'
                        : state === 'exam'
                          ? 'Examen'
                          : 'Ocupada'
                  }`}
                  className={[
                    'border-r border-slate-200 last:border-r-0',
                    isSubjectMatch
                      ? 'bg-emerald-600'
                      : state === 'exam'
                        ? 'bg-red-800'
                        : state === 'occupied'
                          ? 'bg-red-600'
                          : 'bg-white',
                    initialSlotIndex === idx
                      ? 'ring-2 ring-inset ring-slate-900'
                      : '',
                  ].join(' ')}
                />
              );
            })}
          </div>
          {selectedSlot && (
            <p className="mt-1.5 text-xs text-slate-600">
              Franja seleccionada:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {selectedSlot.label}
              </span>
            </p>
          )}
        </div>

        {/* Chronological Schedule List */}
        <div className="p-5 overflow-y-auto flex-1">
          {room.periods.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-slate-800">
                Aula libre durante toda la jornada
              </p>
              <p className="mt-1 text-xs text-slate-500">
                No constan clases ni reservas públicas en WebUntis para esta fecha.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {room.periods.map((period) => {
                const isSelectedInterval =
                  selectedSlot !== undefined &&
                  period.startTime < selectedSlot.endTime &&
                  period.endTime > selectedSlot.startTime;
                const isHighlightedSubject = selectedSubject === period.subject;

                return (
                  <div
                    key={`${period.id}-${period.startTime}`}
                    className={[
                      'py-3 first:pt-0 last:pb-0 transition-colors',
                      isHighlightedSubject
                        ? 'bg-emerald-50/70 -mx-3 px-3 rounded-lg'
                        : isSelectedInterval
                          ? 'bg-slate-50 -mx-3 px-3 rounded-lg'
                          : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {period.subject}
                        </p>
                        {period.subjectAlt && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {period.subjectAlt}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium text-slate-700 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {period.startLabel}–{period.endLabel}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                        {period.isExam && (
                          <span className="font-semibold text-red-800">Examen</span>
                        )}
                        {period.lessonText && period.lessonText !== period.subject && (
                          <span>{period.lessonText}</span>
                        )}
                        {period.groups.length > 0 && (
                          <>
                            {(period.isExam ||
                              (period.lessonText &&
                                period.lessonText !== period.subject)) && (
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                            )}
                            <span>Grupo: {period.groups.join(', ')}</span>
                          </>
                        )}
                        {period.teachers.length > 0 && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            <span>Docente: {period.teachers.join(', ')}</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onSelectSubject(
                            isHighlightedSubject ? null : period.subject
                          )
                        }
                        className={[
                          'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                          isHighlightedSubject
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'text-emerald-700 hover:bg-emerald-50',
                        ].join(' ')}
                      >
                        <Highlighter className="w-3 h-3" />
                        {isHighlightedSubject
                          ? 'Quitar resaltado'
                          : 'Marcar en verde'}
                      </button>
                    </div>

                    {(period.periodText || period.substText) && (
                      <p className="mt-1.5 text-xs text-slate-600">
                        {[period.periodText, period.substText]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <a
            href={webUntisUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-red-700 hover:underline"
          >
            Ver en WebUntis UPV/EHU
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
