import React, { useMemo, useState } from "react";
import { format, subDays, startOfToday } from "date-fns";
import { X, Clock } from "lucide-react";

interface HeatmapData {
  date: string;
  success: number;
  relapse: number;
  hours?: Record<number, string[]>;
}

interface GithubHeatmapProps {
  data: HeatmapData[];
}

export function GithubHeatmap({ data }: GithubHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<{ dateStr: string; record?: HeatmapData } | null>(null);

  const daysMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    if (data) {
      data.forEach((d) => map.set(d.date, d));
    }
    return map;
  }, [data]);

  // Generate last 365 days
  const calendarDays = useMemo(() => {
    const days = [];
    const today = startOfToday();
    for (let i = 364; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const record = daysMap.get(dateStr);
      days.push({
        dateStr,
        date: d,
        record,
      });
    }
    return days;
  }, [daysMap]);

  // Group into weeks (columns)
  const weeks = useMemo(() => {
    const cols = [];
    let currentWeek = [];

    const firstDayIndex = calendarDays[0].date.getDay();

    for (let i = 0; i < firstDayIndex; i++) {
      currentWeek.push(null);
    }

    for (const day of calendarDays) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      cols.push(currentWeek);
    }
    return cols;
  }, [calendarDays]);

  const getColorClass = (record?: HeatmapData, isSelected?: boolean) => {
    let baseClass = "bg-[var(--bg-elevated)] hover:bg-[var(--border-default)]";
    if (record) {
      if (record.relapse > 0) {
        baseClass = "bg-[var(--accent-danger)] opacity-80 shadow-[0_0_8px_rgba(255,23,68,0.4)]";
      } else if (record.success > 0) {
        if (record.success >= 3) baseClass = "bg-[var(--accent-success)] shadow-[0_0_8px_rgba(0,230,118,0.4)]";
        else if (record.success === 2) baseClass = "bg-[var(--accent-success)] opacity-80";
        else baseClass = "bg-[var(--accent-success)] opacity-60";
      }
    }
    if (isSelected) {
      return `${baseClass} ring-2 ring-white scale-110 z-10 relative`;
    }
    return baseClass;
  };

  const getTooltipText = (day: any) => {
    if (!day) return "";
    const { dateStr, record } = day;
    if (!record || (record.success === 0 && record.relapse === 0)) {
      return `${dateStr}: No activity`;
    }
    return `${dateStr}: ${record.success} Check-ins, ${record.relapse} Relapses`;
  };

  const renderHourlyBreakdown = () => {
    if (!selectedDay) return null;
    
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const record = selectedDay.record;
    const hoursData = record?.hours || {};

    return (
      <div className="mt-4 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent-info)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Hourly Breakdown: {selectedDay.dateStr}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={() => setSelectedDay(null)} 
            className="text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {hoursArray.map((hour) => {
            // Handle both string and number keys from JSON
            const statuses = hoursData[hour] || hoursData[hour.toString()] || [];
            const hasRelapse = statuses.includes("relapse");
            const hasSuccess = statuses.includes("success");
            
            console.log(`Hour ${hour} data:`, statuses);
            
            let colorClass = "bg-[var(--bg-elevated)] border-[var(--border-default)]";
            if (hasRelapse) colorClass = "bg-[rgba(255,23,68,0.15)] border-[var(--accent-danger)] text-[var(--accent-danger)] shadow-[0_0_10px_rgba(255,23,68,0.2)]";
            else if (hasSuccess) colorClass = "bg-[rgba(0,230,118,0.15)] border-[var(--accent-success)] text-[var(--accent-success)] shadow-[0_0_10px_rgba(0,230,118,0.2)]";

            return (
              <div 
                key={`heatmap-hour-${hour}`} 
                className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${colorClass}`}
              >
                <span className="text-[10px] font-bold opacity-80">{hour.toString().padStart(2, '0')}:00</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto no-scrollbar py-2">
        <div className="flex gap-1 min-w-max">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((day, dIdx) => {
                const isSelected = selectedDay?.dateStr === day?.dateStr;
                return (
                  <div
                    key={dIdx}
                    role="button"
                    tabIndex={day ? 0 : -1}
                    title={getTooltipText(day)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (day) {
                        setSelectedDay({ dateStr: day.dateStr, record: day.record });
                      }
                    }}
                    className={`w-3 h-3 md:w-[14px] md:h-[14px] rounded-sm cursor-pointer transition-all duration-300 ${
                      day ? getColorClass(day.record, isSelected) : "bg-transparent cursor-default pointer-events-none"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-[var(--bg-elevated)]" />
            <div className="w-3 h-3 rounded-sm bg-[var(--accent-success)] opacity-60" />
            <div className="w-3 h-3 rounded-sm bg-[var(--accent-success)] opacity-80" />
            <div className="w-3 h-3 rounded-sm bg-[var(--accent-success)] shadow-[0_0_8px_rgba(0,230,118,0.4)]" />
            <div className="w-3 h-3 rounded-sm bg-[var(--accent-danger)] opacity-80 shadow-[0_0_8px_rgba(255,23,68,0.4)]" />
          </div>
          <span>More/Relapse</span>
        </div>
      </div>

      {renderHourlyBreakdown()}
    </div>
  );
}
