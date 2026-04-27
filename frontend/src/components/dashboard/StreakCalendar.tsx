import { useMemo, useState } from "react";
import { X, Clock } from "lucide-react";

interface StreakDay {
  date: string;
  result: "success" | "relapse" | "partial" | null;
  created_at?: string;
}

interface StreakCalendarProps {
  data: StreakDay[];
  months?: number;
}

export function StreakCalendar({ data, months = 3 }: StreakCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const calendarData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Align to Sunday

    // Group data by date
    const dataMap = new Map<string, { result: string | null; hours: Record<number, string[]> }>();
    
    safeData.forEach((d) => {
      let hoursMap: Record<number, string[]> = {};
      
      // Attempt to extract hour if created_at is present
      if (d.created_at && d.result) {
        try {
          // ensure the date parses correctly by adding Z if missing, or replacing space with T
          const dt = new Date(d.created_at);
          const hour = dt.getHours();
          hoursMap[hour] = [d.result];
        } catch (e) {}
      }

      const existing = dataMap.get(d.date);
      if (existing) {
        // If there's already an entry for this date, merge hours
        if (d.created_at && d.result) {
          try {
            const dt = new Date(d.created_at);
            const hour = dt.getHours();
            if (!existing.hours[hour]) existing.hours[hour] = [];
            existing.hours[hour].push(d.result);
          } catch(e) {}
        }
        // If there is any relapse for the day, mark the day as relapse
        existing.result = (existing.result === "relapse" || d.result === "relapse") ? "relapse" : d.result;
      } else {
        dataMap.set(d.date, { result: d.result, hours: hoursMap });
      }
    });

    const weeks: { date: Date; record: any }[][] = [];
    let currentWeek: { date: Date; record: any }[] = [];

    const cursor = new Date(startDate);
    while (cursor <= today) {
      const dateStr = cursor.toISOString().split("T")[0];
      currentWeek.push({
        date: new Date(cursor),
        record: dataMap.get(dateStr) || { result: null, hours: {} },
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { weeks, dataMap };
  }, [data, months]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    calendarData.weeks.forEach((week, weekIdx) => {
      const firstDay = week[0];
      if (firstDay && firstDay.date.getMonth() !== lastMonth) {
        lastMonth = firstDay.date.getMonth();
        labels.push({
          label: firstDay.date.toLocaleString("en", { month: "short" }),
          col: weekIdx,
        });
      }
    });

    return labels;
  }, [calendarData]);

  const getColor = (result: string | null, isToday: boolean, isSelected: boolean) => {
    let base = "bg-[var(--bg-elevated)]";
    if (result === "success") base = "bg-[var(--accent-success)] shadow-[0_0_8px_rgba(0,230,118,0.4)] opacity-90";
    else if (result === "relapse") base = "bg-[var(--accent-danger)] shadow-[0_0_8px_rgba(255,23,68,0.4)] opacity-90";
    else if (result === "partial") base = "bg-[var(--accent-warning)] opacity-90";
    
    if (isSelected) return `${base} ring-2 ring-white scale-125 z-10 relative shadow-lg`;
    if (isToday && !isSelected) return `${base} ring-2 ring-[var(--accent-fire)]`;
    return base;
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const stats = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const uniqueDays = new Set(safeData.map(d => d.date));
    const total = uniqueDays.size;
    let success = 0;
    let relapse = 0;
    
    uniqueDays.forEach(date => {
      const dayRecords = safeData.filter(d => d.date === date);
      if (dayRecords.some(d => d.result === "relapse")) {
        relapse++;
      } else if (dayRecords.some(d => d.result === "success")) {
        success++;
      }
    });

    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, relapse, rate };
  }, [data]);

  const renderHourlyBreakdown = () => {
    if (!selectedDate) return null;
    
    const record = calendarData.dataMap.get(selectedDate) || { result: null, hours: {} };
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="mt-6 p-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--accent-info)]" />
            <h3 className="font-bold text-[var(--text-primary)]">
              {selectedDate} Breakdown
            </h3>
          </div>
          <button 
            type="button"
            onClick={() => setSelectedDate(null)} 
            className="text-[var(--text-muted)] hover:text-white transition-colors bg-[var(--bg-elevated)] p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {hoursArray.map((hour) => {
            const statuses = record.hours[hour] || record.hours[hour.toString()] || [];
            const hasRelapse = statuses.includes("relapse");
            const hasSuccess = statuses.includes("success");
            
            let colorClass = "bg-[var(--bg-elevated)] border-[var(--border-default)] opacity-50";
            if (hasRelapse) colorClass = "bg-[rgba(255,23,68,0.15)] border-[var(--accent-danger)] text-[var(--accent-danger)] shadow-[0_0_10px_rgba(255,23,68,0.2)]";
            else if (hasSuccess) colorClass = "bg-[rgba(0,230,118,0.15)] border-[var(--accent-success)] text-[var(--accent-success)] shadow-[0_0_10px_rgba(0,230,118,0.2)]";

            return (
              <div 
                key={`streak-hour-${hour}`} 
                className={`flex flex-col items-center justify-center py-2.5 rounded border transition-all ${colorClass}`}
              >
                <span className="text-[11px] font-bold opacity-90">{hour.toString().padStart(2, '0')}:00</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[var(--text-primary)]">Streak Calendar</h3>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[var(--accent-success)]" />
            Clean
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[var(--accent-danger)]" />
            Relapse
          </span>
        </div>
      </div>

      <div className="relative mb-1 ml-8">
        <div className="flex gap-[3px]">
          {calendarData.weeks.map((_, i) => {
            const label = monthLabels.find((l) => l.col === i);
            return (
              <div key={i} className="w-[14px] text-[10px] text-[var(--text-muted)]">
                {label?.label || ""}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-0">
        <div className="flex flex-col gap-[3px] mr-2 text-[10px] text-[var(--text-muted)] pt-0">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
            <div key={i} className="h-[14px] flex items-center">
              {label}
            </div>
          ))}
        </div>

        <div className="flex gap-[3px] overflow-x-auto pb-2 no-scrollbar">
          {calendarData.weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[3px]">
              {week.map((day, dayIdx) => {
                const dateStr = day.date.toISOString().split("T")[0];
                const isToday = dateStr === todayStr;
                const isFuture = day.date > new Date();
                const isSelected = selectedDate === dateStr;

                return (
                  <div
                    key={dayIdx}
                    role="button"
                    tabIndex={!isFuture ? 0 : -1}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isFuture) setSelectedDate(dateStr);
                    }}
                    className={`streak-day ${getColor(day.record.result, isToday, isSelected)} ${
                      isFuture ? "opacity-20 cursor-default pointer-events-none" : "opacity-100 hover:scale-125 cursor-pointer"
                    } transition-all duration-200`}
                    title={`${dateStr}: ${day.record.result || "no check-in"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {renderHourlyBreakdown()}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-default)]">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[var(--text-muted)]">
            {stats.total} days logged
          </span>
          <span className="text-[var(--accent-success)] font-semibold">
            {stats.success} clean
          </span>
          <span className="text-[var(--accent-danger)] font-semibold">
            {stats.relapse} relapses
          </span>
        </div>
        <div className="text-sm font-bold">
          <span className={stats.rate >= 70 ? "text-[var(--accent-success)]" : stats.rate >= 40 ? "text-[var(--accent-warning)]" : "text-[var(--accent-danger)]"}>
            {stats.rate}%
          </span>
          <span className="text-[var(--text-muted)] text-xs ml-1">success rate</span>
        </div>
      </div>
    </div>
  );
}
