import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  getCurrentUser,
  getHealth,
  getMyShifts,
  getSchedule,
  getSites,
  getStaff,
  login,
  logout,
  updateShiftAssignment,
  type CurrentUser,
  type HealthResponse,
  type MyShift,
  type ScheduleShift,
  type Site,
  type StaffProfile,
} from "./apiClient";

type Status = "loading" | "success" | "error";

type ScheduleData = {
  site: Site;
  shifts: ScheduleShift[];
};

const shiftOrder = ["MORNING", "AFTERNOON", "NIGHT"] as const;
const shiftTimes: Record<(typeof shiftOrder)[number], string> = {
  MORNING: "06:00-14:00",
  AFTERNOON: "14:00-22:00",
  NIGHT: "22:00-06:00",
};

function getCurrentMonday() {
  const now = new Date();
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = localMidnight.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  localMidnight.setDate(localMidnight.getDate() - daysSinceMonday);

  const year = localMidnight.getFullYear();
  const month = `${localMidnight.getMonth() + 1}`.padStart(2, "0");
  const day = `${localMidnight.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getShiftTimeLabel(startAt: string, endAt: string) {
  const start = new Date(startAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const end = new Date(endAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return `${start} - ${end}`;
}

function groupScheduleByDay(shifts: ScheduleShift[]) {
  const dayMap = new Map<
    string,
    {
      label: string;
      shifts: Partial<Record<(typeof shiftOrder)[number], ScheduleShift>>;
    }
  >();

  for (const shift of shifts) {
    const key = shift.startAt.slice(0, 10);
    const current = dayMap.get(key) ?? {
      label: formatDisplayDate(shift.startAt),
      shifts: {},
    };

    current.shifts[shift.kind] = shift;
    dayMap.set(key, current);
  }

  return Array.from(dayMap.entries()).map(([dateKey, value]) => ({
    dateKey,
    label: value.label,
    shifts: value.shifts,
  }));
}

function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [email, setEmail] = useState("supervisor@example.com");
  const [password, setPassword] = useState("password123");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weekStart, setWeekStart] = useState(getCurrentMonday);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [updatingShiftId, setUpdatingShiftId] = useState<number | null>(null);

  const groupedSchedule = useMemo(
    () => groupScheduleByDay(scheduleData?.shifts ?? []),
    [scheduleData],
  );

  useEffect(() => {
    async function loadHealth() {
      try {
        const result = await getHealth();
        setHealth(result);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setHealthError(error instanceof Error ? error.message : "Unknown error");
      }
    }

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      }
    }

    void loadHealth();
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSites([]);
      setSelectedSiteId(null);
      setStaff([]);
      setScheduleData(null);
      setMyShifts([]);
      setPageError(null);
      setAssignmentError(null);
      setAssignmentMessage(null);
      return;
    }

    async function loadSupervisorPage() {
      setIsPageLoading(true);
      setPageError(null);

      try {
        const availableSites = await getSites();
        const staffProfiles = await getStaff();
        const chosenSite =
          availableSites.find((site) => site.name === "Central Operations Hub") ??
          availableSites[0] ??
          null;

        setSites(availableSites);
        setStaff(staffProfiles);
        setSelectedSiteId(chosenSite?.id ?? null);

        if (!chosenSite) {
          setScheduleData(null);
          return;
        }

        const schedule = await getSchedule(chosenSite.id, weekStart);
        setScheduleData({
          site: schedule.site,
          shifts: schedule.shifts,
        });
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Failed to load page.");
      } finally {
        setIsPageLoading(false);
      }
    }

    async function loadStaffPage() {
      setIsPageLoading(true);
      setPageError(null);

      try {
        const result = await getMyShifts(weekStart);
        setMyShifts(result.shifts);
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Failed to load shifts.");
      } finally {
        setIsPageLoading(false);
      }
    }

    if (currentUser.role === "SUPERVISOR") {
      void loadSupervisorPage();
    } else {
      void loadStaffPage();
    }
  }, [currentUser, weekStart]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    setAuthMessage(null);

    try {
      const user = await login(email, password);
      setCurrentUser(user);
      setAuthMessage(`Logged in as ${user.name} (${user.role}).`);
    } catch (error) {
      setCurrentUser(null);
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsSubmitting(true);
    setLoginError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      await logout();
      setCurrentUser(null);
      setAuthMessage("Logged out successfully.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshSchedule(siteId: number) {
    const schedule = await getSchedule(siteId, weekStart);
    setScheduleData({
      site: schedule.site,
      shifts: schedule.shifts,
    });
  }

  async function handleAssignmentChange(
    shiftId: number,
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const value = event.target.value;
    const staffId = value === "" ? null : Number(value);

    setUpdatingShiftId(shiftId);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      await updateShiftAssignment(shiftId, staffId);

      if (selectedSiteId !== null) {
        await refreshSchedule(selectedSiteId);
      }

      setAssignmentMessage(
        staffId === null
          ? "Shift unassigned successfully."
          : "Shift assignment updated successfully.",
      );
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : "Failed to update assignment.",
      );
    } finally {
      setUpdatingShiftId(null);
    }
  }

  function renderShiftCell(shift: ScheduleShift | undefined) {
    if (!shift) {
      return <span className="empty-copy">No shift</span>;
    }

    return (
      <div className="shift-card">
        <p className="shift-time">{shiftTimes[shift.kind]}</p>
        <p className="shift-datetime">{getShiftTimeLabel(shift.startAt, shift.endAt)}</p>
        <p className="shift-meta">
          Certification: {shift.requiredCertification?.name ?? "None"}
        </p>
        <p className="shift-meta">
          Assigned: {shift.assignment?.user.name ?? "Unassigned"}
        </p>
        <label className="dropdown-label">
          Assign staff
          <select
            value={shift.assignment?.staffId ?? ""}
            disabled={updatingShiftId === shift.id}
            onChange={(event) => void handleAssignmentChange(shift.id, event)}
          >
            <option value="">Unassign</option>
            {staff.map((staffProfile) => (
              <option key={staffProfile.id} value={staffProfile.id}>
                {staffProfile.user.name} ({staffProfile.certifications.map((item) => item.name).join(", ") || "No certifications"})
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  function renderSupervisorView() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Weekly Schedule Builder</h2>
            <p className="description small-copy">
              Week of {formatDisplayDate(weekStart)}. Use the dropdowns to assign,
              reassign, or unassign shifts.
            </p>
            <p className="muted-copy top-gap">
              Site: {scheduleData?.site.name ?? (sites[0]?.name ?? "Loading site...")}
            </p>
          </div>

          <label className="site-picker">
            Week Start
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </label>
        </div>

        {assignmentMessage && <p className="success-message">{assignmentMessage}</p>}
        {assignmentError && <p className="error-message">{assignmentError}</p>}
        {pageError && <p className="error-message">{pageError}</p>}
        {isPageLoading && <p className="muted-copy">Loading schedule...</p>}
        {!isPageLoading && !pageError && groupedSchedule.length === 0 && (
          <p className="muted-copy">No shifts found for this site and week.</p>
        )}

        {!isPageLoading && !pageError && groupedSchedule.length > 0 && (
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Morning</th>
                  <th>Afternoon</th>
                  <th>Night</th>
                </tr>
              </thead>
              <tbody>
                {groupedSchedule.map((day) => (
                  <tr key={day.dateKey}>
                    <th>{day.label}</th>
                    {shiftOrder.map((kind) => (
                      <td key={`${day.dateKey}-${kind}`}>{renderShiftCell(day.shifts[kind])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderStaffView() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>My Shifts</h2>
            <p className="description small-copy">
              Your assigned shifts for the week of {formatDisplayDate(weekStart)}.
            </p>
          </div>

          <label className="site-picker">
            Week Start
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </label>
        </div>

        {pageError && <p className="error-message">{pageError}</p>}
        {isPageLoading && <p className="muted-copy">Loading your shifts...</p>}
        {!isPageLoading && !pageError && myShifts.length === 0 && (
          <p className="muted-copy">You do not have any assigned shifts for this week.</p>
        )}

        {!isPageLoading && !pageError && myShifts.length > 0 && (
          <div className="shift-list">
            {myShifts.map((shift) => (
              <article key={shift.id} className="shift-list-item">
                <p className="shift-time">{shift.site.name}</p>
                <p className="shift-meta">
                  {formatDisplayDate(shift.startAt)} • {shift.kind}
                </p>
                <p className="shift-meta">
                  {getShiftTimeLabel(shift.startAt, shift.endAt)}
                </p>
                <p className="shift-meta">
                  Certification: {shift.requiredCertification?.name ?? "None"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="app-shell">
      <section className="status-card app-card">
        <div className="top-bar">
          <div>
            <p className="eyebrow">Workforce Scheduler</p>
            <h1>Weekly Scheduling</h1>
            <p className="description">
              Supervisors can build the weekly schedule. Staff can review their own
              assigned shifts.
            </p>
          </div>

          {currentUser && (
            <button type="button" onClick={handleLogout} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Logout"}
            </button>
          )}
        </div>

        <div className={`status-pill status-${status}`}>
          {status === "loading" && "Checking API connection..."}
          {status === "success" && "API is reachable"}
          {status === "error" && "API is not reachable"}
        </div>

        {health && (
          <dl className="details compact-details">
            <div>
              <dt>API Status</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{new Date(health.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        )}

        {healthError && <p className="error-message">{healthError}</p>}
        {authMessage && <p className="success-message">{authMessage}</p>}
        {loginError && <p className="error-message">{loginError}</p>}

        {!currentUser && (
          <section className="panel">
            <h2>Login</h2>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
              </button>
            </form>
          </section>
        )}

        {currentUser && (
          <>
            <section className="panel user-summary">
              <div>
                <h2>Current User</h2>
                <p className="muted-copy">
                  {currentUser.name} • {currentUser.email}
                </p>
              </div>
              <div className="role-badge">{currentUser.role}</div>
            </section>

            {currentUser.role === "SUPERVISOR"
              ? renderSupervisorView()
              : renderStaffView()}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
