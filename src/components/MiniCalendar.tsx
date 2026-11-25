import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getAllMonthsES,
  getMondayOfWeek,
  getMonthCalendarCells,
  parseISODate,
} from '../utils/dateUtils';

interface MiniCalendarProps {
  selectedDate: string;
  todayISO: string;
  onSelectDate: (isoDate: string) => void;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const SELECTABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

export function MiniCalendar({
  selectedDate,
  todayISO,
  onSelectDate,
}: MiniCalendarProps) {
  const initialDate = parseISODate(selectedDate);
  const [viewYear, setViewYear] = useState(initialDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getUTCMonth());

  // Keep calendar month synchronized when date changes externally (e.g. next/prev day)
  useEffect(() => {
    const parsed = parseISODate(selectedDate);
    setViewYear(parsed.getUTCFullYear());
    setViewMonth(parsed.getUTCMonth());
  }, [selectedDate]);

  const months = useMemo(() => getAllMonthsES(), []);
  const cells = useMemo(
    () => getMonthCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const activeWeekMonday = useMemo(
    () => getMondayOfWeek(selectedDate),
    [selectedDate]
  );

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => Math.max(2020, y - 1));
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => Math.min(2035, y + 1));
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Mes anterior"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-red-600 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <select
            aria-label="Seleccionar mes"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="text-sm font-semibold text-slate-900 bg-transparent hover:bg-slate-100 rounded px-1.5 py-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600"
          >
            {months.map((label, idx) => (
              <option key={label} value={idx}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Seleccionar año"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="text-sm font-semibold font-mono tabular-nums text-slate-700 bg-transparent hover:bg-slate-100 rounded px-1 py-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600"
          >
            {SELECTABLE_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Mes siguiente"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-red-600 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_HEADERS.map((dayHeader) => (
          <div
            key={dayHeader}
            className="text-center text-[11px] font-medium text-slate-500 py-1 select-none"
          >
            {dayHeader}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell) => {
          const isSelected = cell.iso === selectedDate;
          const isToday = cell.iso === todayISO;
          const isInActiveWeek = getMondayOfWeek(cell.iso) === activeWeekMonday;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate(cell.iso)}
              aria-pressed={isSelected}
              aria-label={`Seleccionar ${cell.iso}`}
              className={[
                'h-8 w-full text-xs font-mono tabular-nums transition-colors relative flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600',
                isSelected
                  ? 'bg-slate-900 text-white font-semibold rounded-md z-10'
                  : isInActiveWeek
                    ? 'bg-slate-100 text-slate-900 hover:bg-slate-200 first:rounded-l-md'
                    : cell.inCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100 rounded-md'
                      : 'text-slate-400 hover:bg-slate-50 rounded-md',
                isToday && !isSelected
                  ? 'ring-1 ring-inset ring-red-600 font-semibold text-red-700 rounded-md'
                  : '',
              ].join(' ')}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <label className="text-xs text-slate-500 shrink-0" htmlFor="direct-date-input">
          Fecha exacta
        </label>
        <input
          id="direct-date-input"
          type="date"
          min="2020-01-01"
          max="2035-12-31"
          value={selectedDate}
          onChange={(e) => {
            if (e.target.value) {
              onSelectDate(e.target.value);
            }
          }}
          className="text-xs font-mono tabular-nums text-slate-800 border border-slate-200 rounded-md px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white focus:outline-2 focus:outline-red-600"
        />
      </div>

      {selectedDate !== todayISO && (
        <button
          type="button"
          onClick={() => onSelectDate(todayISO)}
          className="mt-2.5 w-full py-1.5 px-3 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}
