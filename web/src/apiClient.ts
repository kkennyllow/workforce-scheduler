export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPERVISOR" | "STAFF";
};

export type Site = {
  id: number;
  name: string;
};

export type Certification = {
  id: number;
  name: string;
};

export type StaffProfile = {
  id: number;
  user: CurrentUser;
  certifications: Certification[];
};

export type ScheduleShift = {
  id: number;
  siteId: number;
  kind: "MORNING" | "AFTERNOON" | "NIGHT";
  startAt: string;
  endAt: string;
  requiredCertification: Certification | null;
  assignment: {
    id: number;
    staffId: number;
    user: CurrentUser;
  } | null;
};

export type MyShift = ScheduleShift & {
  assignmentId: number;
  site: Site;
};

type ApiError = {
  error?: string;
  message?: string;
};

type ScheduleResponse = {
  site: Site;
  weekStart: string;
  weekEnd: string;
  shifts: ScheduleShift[];
};

type MyShiftsResponse = {
  weekStart: string;
  weekEnd: string;
  shifts: MyShift[];
};

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as ApiError;
    return data.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseJson<T>(response);
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  return request<CurrentUser>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>("/api/me");
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getSites(): Promise<Site[]> {
  return request<Site[]>("/api/sites");
}

export async function getStaff(): Promise<StaffProfile[]> {
  return request<StaffProfile[]>("/api/staff");
}

export async function getSchedule(siteId: number, weekStart: string) {
  return request<ScheduleResponse>(
    `/api/schedule?siteId=${siteId}&weekStart=${weekStart}`,
  );
}

export async function getMyShifts(weekStart: string) {
  return request<MyShiftsResponse>(`/api/my-shifts?weekStart=${weekStart}`);
}

export async function updateShiftAssignment(shiftId: number, staffId: number | null) {
  return request<{ shift: ScheduleShift }>(`/api/shifts/${shiftId}/assignment`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ staffId }),
  });
}
