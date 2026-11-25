import { BookOpen, Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface SubjectOption {
  name: string;
  altName: string;
  rooms: string[];
  slotsCount: number;
}

interface SubjectSearchProps {
  subjects: SubjectOption[];
  selectedSubject: string | null;
  onlyMatchingRooms: boolean;
  onSelectSubject: (subjectName: string | null) => void;
  onToggleOnlyMatchingRooms: (value: boolean) => void;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function SubjectSearch({
  subjects,
  selectedSubject,
  onlyMatchingRooms,
  onSelectSubject,
  onToggleOnlyMatchingRooms,
}: SubjectSearchProps) {
  const [query, setQuery] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSubjects = useMemo(() => {
    const norm = normalizeText(query);
    if (!norm) return subjects;
    return subjects.filter(
      (item) =>
        normalizeText(item.name).includes(norm) ||
        normalizeText(item.altName).includes(norm)
    );
  }, [subjects, query]);

  const activeInfo = useMemo(
    () => subjects.find((s) => s.name === selectedSubject) ?? null,
    [subjects, selectedSubject]
  );

  const handleChoose = (subjectName: string) => {
    if (selectedSubject === subjectName) {
      onSelectSubject(null);
      setQuery('');
    } else {
      onSelectSubject(subjectName);
      setQuery('');
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSelectSubject(null);
    setQuery('');
    onToggleOnlyMatchingRooms(false);
  };

  return (
    <div
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="subject-filter-input"
          className="text-xs font-semibold text-slate-900"
        >
          Buscar asignatura
        </label>
        <span className="text-[11px] font-mono tabular-nums text-slate-500">
          {subjects.length} hoy
        </span>
      </div>

      {/* Combobox input */}
      <div className="relative">
        <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="subject-filter-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="subject-options-listbox"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Enter' && filteredSubjects.length > 0 && open) {
              e.preventDefault();
              handleChoose(filteredSubjects[0].name);
            }
          }}
          placeholder={
            selectedSubject
              ? 'Cambiar asignatura...'
              : 'Escribe o elige una asignatura...'
          }
          className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-2 focus:outline-emerald-600"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Cerrar lista de asignaturas' : 'Abrir lista de asignaturas'}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            id="subject-options-listbox"
            role="listbox"
            className="absolute left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredSubjects.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                No hay asignaturas que coincidan con "{query}".
              </div>
            ) : (
              filteredSubjects.map((item) => {
                const isSelected = selectedSubject === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleChoose(item.name)}
                    className={[
                      'w-full px-3 py-2 text-left transition-colors flex items-start justify-between gap-2 cursor-pointer',
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950'
                        : 'hover:bg-slate-50 text-slate-800',
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug truncate">
                        {item.name}
                      </p>
                      <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-mono tabular-nums">
                          {item.rooms.length}{' '}
                          {item.rooms.length === 1 ? 'aula' : 'aulas'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">
                          {item.rooms.slice(0, 3).join(', ')}
                          {item.rooms.length > 3 ? '…' : ''}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected Subject Active State */}
      {selectedSubject ? (
        <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <span className="w-2.5 h-2.5 bg-emerald-600 inline-block shrink-0" />
                Marcada en verde
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 leading-snug">
                {selectedSubject}
              </p>
              {activeInfo ? (
                <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                  {activeInfo.rooms.length}{' '}
                  {activeInfo.rooms.length === 1 ? 'aula' : 'aulas'} ·{' '}
                  {(activeInfo.slotsCount * 0.5).toFixed(1).replace('.0', '')} h
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Sin clases registradas en esta fecha
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleClear}
              aria-label="Quitar selección de asignatura"
              title="Volver a la normalidad"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMatchingRooms}
              onChange={(e) => onToggleOnlyMatchingRooms(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
            />
            <span>Mostrar solo aulas con esta asignatura</span>
          </label>

          <button
            type="button"
            onClick={handleClear}
            className="w-full py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
          >
            Quitar selección
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Selecciona una asignatura para resaltar sus franjas en verde sobre la cuadrícula.
        </p>
      )}
    </div>
  );
}
