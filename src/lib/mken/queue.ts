import { getServiceRoleDb } from "@/lib/mken/tenant";
import { hostnameFromHeaders, tenantSlugFromSubdomain, slugFromCustomHostname } from "@/lib/mken/tenant-host";

export type PriorityCategory = "none" | "elderly" | "special_needs";
export type TicketStatus = "waiting" | "calling" | "serving" | "completed" | "cancelled" | "no_show";

export type CloseReasonType =
  | "none"
  | "schedule"
  | "predictive_cutoff"
  | "capacity"
  | "buffer"
  | "manual_pause"
  | "manual_emergency";

export interface CustomerProfile {
  id: string;
  tenantSlug: string;
  name: string;
  phone: string;
  notes?: string;
  visitCount: number;
  isKnownSenior?: boolean;
  isKnownSpecialNeeds?: boolean;
  lastVisitedAt?: string;
}

export interface Ticket {
  id: string;
  tenantSlug: string;
  branchId?: string | null;
  customerId?: string | null;
  customerProfile?: CustomerProfile | null;
  ticketNumber: string;
  originalTicketNumber?: string | null;
  departmentId: string;
  departmentName: string;
  counterId?: string | null;
  status: TicketStatus;
  priorityCategory: PriorityCategory;
  priorityAssignedByUserId?: string | null;
  isPriority: boolean;
  priorityReason?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  waitEstimateMinutes: number;
  calledAt?: string | null;
  servedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceSchedule {
  serviceId: string;
  dayOfWeek: number; // 0: Sunday, 6: Saturday
  openingTime: string; // "08:00"
  closingTime: string; // "16:00"
  isWorkingDay: boolean;
  avgServiceTimeMinutes: number;
}

export interface ServiceIntakeConfig {
  serviceId: string;
  tenantSlug: string;
  name: string;
  departmentId: string;
  maxDailyCapacity: number;
  maxActiveWaitingLimit: number;
  avgServiceTimeMinutes: number;
  autoIntakeEnabled: boolean;
  manualOverrideActive: boolean;
  manualOverrideExpiresAt?: string | null;
  manualOverrideType?: "extend_time" | "add_capacity" | "pause" | "emergency_close" | null;
  manualOverrideReason?: string | null;
  isIntakeOpen: boolean;
  closedReason?: string | null;
}

export interface IntakeEvaluation {
  serviceId: string;
  tenantSlug: string;
  isOpen: boolean;
  closeReasonType: CloseReasonType;
  closeReason: string;
  contextMessage: string;
  stats: {
    todayIssued: number;
    todayActive: number; // Excludes cancelled and no_show (recycled capacity!)
    dailyCapacity: number;
    activeWaiting: number;
    waitingBufferLimit: number;
    avgServiceTimeMinutes: number;
    predictiveCutoffTime: string; // e.g. "15:35"
    closingTime: string; // e.g. "16:00"
    openingTime: string; // e.g. "08:00"
    isWorkingDay: boolean;
  };
  manualOverride: {
    active: boolean;
    type?: string | null;
    expiresAt?: string | null;
    remainingMinutes?: number | null;
    reason?: string | null;
  };
  autoIntakeEnabled: boolean;
}

export interface DisplayScreenSettings {
  audioAlert: boolean;
  theme: "dark" | "light";
  visibleServices: string[];
  recentCallsLimit: number;
}

export interface DisplayScreen {
  id: string;
  tenantSlug: string;
  branchId?: string | null;
  screenName: string;
  screenToken: string;
  displaySettings: DisplayScreenSettings;
  isOnline: boolean;
  lastPingAt: string;
  createdAt: string;
}

export interface QueueState {
  tenantSlug: string;
  nowCalling: Ticket | null;
  recentCalls: Ticket[];
  waitingTickets: Ticket[];
  consecutivePriorityCalls: number;
  stats: {
    totalWaiting: number;
    priorityWaiting: number;
    standardWaiting: number;
    activeCounters: number;
  };
}

export const PRIORITY_CONFIG = {
  elderly: {
    label: "كبار السن",
    badgeLabel: "👴 كبار السن",
    icon: "👴",
    themeClass: "border-amber-500/60 text-amber-300 bg-amber-950/40 shadow-amber-500/20",
    glowColor: "rgba(245, 158, 11, 0.4)",
    spokenPrefix: "أولوية كبار السن",
  },
  special_needs: {
    label: "ذوو الاحتياجات الخاصة",
    badgeLabel: "♿ احتياجات خاصة",
    icon: "♿",
    themeClass: "border-cyan-500/60 text-cyan-300 bg-cyan-950/40 shadow-cyan-500/20",
    glowColor: "rgba(0, 182, 212, 0.4)",
    spokenPrefix: "أولوية رعاية خاصة",
  },
  none: {
    label: "تذكرة عادية",
    badgeLabel: "مسار عام",
    icon: "🎫",
    themeClass: "border-slate-700 text-slate-300 bg-slate-800/40",
    glowColor: "rgba(59, 130, 246, 0.2)",
    spokenPrefix: "",
  },
} as const;

/**
 * Polite, Context-Aware Customer Guidance Messages (نماذج الرسائل المنمقة حسب سبب الإغلاق)
 */
export const CONTEXT_AWARE_MESSAGES: Record<CloseReasonType, string> = {
  none: "الاستقبال مفتوح وجاهز لإصدار التذاكر فوراً.",
  schedule:
    "أهلاً بك، نسعد بخدمتكم دائماً. نستقبل ضيوفنا الكرام في هذا الفرع من الأحد إلى الخميس، من الساعة 08:00 صباحاً وحتى 04:00 عصراً. يُسعدنا استقبالك غداً فور الافتتاح.",
  predictive_cutoff:
    "عميلنا العزيز، حرصاً منا على تكريس كامل الوقت لخدمة المراجعين المتواجدين حالياً قبل نهاية ساعات العمل الرسمية، تم إيقاف استقبال التذاكر الجديدة لليوم لحين الانتهاء من خدمة المنتظرين. نسعد باستقبالك في يوم العمل التالي.",
  capacity:
    "عميلنا العزيز، حرصاً منا على تكريس كامل الوقت لخدمة المراجعين المتواجدين حالياً بالجودة التي تستحقونها، اكتملت الحصص المتاحة لهذا اليوم. يمكنك التوجه إلى أقرب فرع شاغر أو الحجز المسبق لصباح الغد.",
  buffer:
    "مرحباً بك، تشهد صالة الخدمة حالياً كثافة مراجعين مرتفعة تفوق الطاقة التشغيلية اللحظية. حرصاً على راحتكم، تم تعليق استقبال التذاكر الجديدة مؤقتاً لمدة 15 دقيقة لتخفيف الانتظار، وسيُعاد فتح التسجيل تلقائياً فور توفر سعة.",
  manual_pause:
    "مرحباً بك، تشهد الصالة فترة توقف مؤقتة لتنظيم تدفق المراجعين وضمان انسيابية الخدمة. سيُعاد فتح الاستقبال تلقائياً خلال دقائق معدودة فور استقرار الحركة.",
  manual_emergency:
    "عميلنا الكريم، تم إغلاق استقبال التذاكر لليوم بقرار إداري لتنظيم الخدمة وضمان جودة الرعاية للمراجعين المتواجدين بالصالة. نسعد بخدمتكم في يوم العمل التالي.",
};

// Global fallback in-memory store for instant zero-config resilience & multi-tenant isolation

export interface OnboardingStaff {
  id: string;
  tenantSlug: string;
  name: string;
  phone: string;
  pairingCode: string; // 2-digit verification code e.g. "84"
  pairingCodeExpiresAt: string; // ISO timestamp (5 min expiry)
  onboardingStatus: "pending_approval" | "active" | "rejected" | "off_duty";
  assignedDeskName?: string | null;
  assignedServiceId?: string | null;
  assignedRole?: "counter_agent" | "receptionist" | "supervisor" | null;
  sessionToken?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface CounterLock {
  tenantSlug: string;
  deskName: string;
  serviceId: string;
  assignedStaffId: string;
  assignedStaffName: string;
  lockedAt: string;
  lastHeartbeatAt: string;
}

export interface CustomQueueDefinition {
  id: string;
  tenantSlug: string;
  name: string;
  prefix: string;
  avgServiceTimeMinutes: number;
  maxDailyCapacity: number;
  maxActiveWaitingLimit: number;
  isActive: boolean;
  createdByAdmin?: string;
  createdAt: string;
}

export interface QueueBroadcastEvent {
  type: "SERVICE_CREATED" | "STAFF_JOIN_REQUESTED" | "STAFF_ASSIGNED" | "TICKET_CALLED" | "INTAKE_STATUS_CHANGED";
  tenantSlug: string;
  data: any;
  timestamp: string;
}

interface MemoryStore {
  tickets: Map<string, Ticket>;
  screens: Map<string, DisplayScreen>;
  customers: Map<string, CustomerProfile>; // Keyed by: `${tenantSlug}:${phone}`
  intakeConfigs: Map<string, ServiceIntakeConfig>; // Keyed by: `${tenantSlug}:${serviceId}`
  schedules: Map<string, ServiceSchedule[]>; // Keyed by: `${tenantSlug}:${serviceId}`
  consecutivePriorityCalls: Map<string, number>;
  ticketCounter: Map<string, number>;
  priorityCounter: Map<string, number>;
  pendingStaff: Map<string, OnboardingStaff>; // key: staffId
  counterLocks: Map<string, CounterLock>; // key: `${tenantSlug}:${deskName}`
  customQueues: Map<string, CustomQueueDefinition[]>; // key: tenantSlug
  queueListeners: Set<(event: QueueBroadcastEvent) => void>;

}

declare global {
  // eslint-disable-next-line no-var
  var __mken_queue_store__: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__mken_queue_store__) {
    const store: MemoryStore = {
      tickets: new Map(),
      screens: new Map(),
      customers: new Map(),
      intakeConfigs: new Map(),
      schedules: new Map(),
      consecutivePriorityCalls: new Map(),
      ticketCounter: new Map(),
      priorityCounter: new Map(),
      pendingStaff: new Map(),
      counterLocks: new Map(),
      customQueues: new Map(),
      queueListeners: new Set(),

    };

    const now = new Date();
    const subMinutes = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

    // Known customers for CRM link test
    store.customers.set("default:0559876543", {
      id: "cust-1",
      tenantSlug: "default",
      name: "أبو فهد القحطاني",
      phone: "0559876543",
      notes: "مراجع مسجل مسبقاً — من كبار السن",
      visitCount: 6,
      isKnownSenior: true,
      isKnownSpecialNeeds: false,
      lastVisitedAt: subMinutes(1440),
    });

    store.customers.set("default:0501234567", {
      id: "cust-2",
      tenantSlug: "default",
      name: "سعد بن خالد العتيبي",
      phone: "0501234567",
      notes: "مستفيد مسجل — مستخدم كرسي متحرك",
      visitCount: 3,
      isKnownSenior: false,
      isKnownSpecialNeeds: true,
      lastVisitedAt: subMinutes(2880),
    });

    // Seed mock tickets
    const seedTickets: Ticket[] = [
      {
        id: "seed-t-1",
        tenantSlug: "default",
        customerId: "cust-2",
        customerProfile: store.customers.get("default:0501234567"),
        ticketNumber: "P-104",
        originalTicketNumber: "A-104",
        departmentId: "reception",
        departmentName: "الاستقبال",
        counterId: "كاونتر 1",
        status: "calling",
        priorityCategory: "special_needs",
        isPriority: true,
        priorityReason: "special_needs",
        priorityAssignedByUserId: "staff-reception-01",
        customerName: "سعد بن خالد العتيبي",
        customerPhone: "0501234567",
        waitEstimateMinutes: 0,
        calledAt: subMinutes(1),
        createdAt: subMinutes(18),
        updatedAt: subMinutes(1),
      },
      {
        id: "seed-t-2",
        tenantSlug: "default",
        customerId: "cust-1",
        customerProfile: store.customers.get("default:0559876543"),
        ticketNumber: "P-103",
        originalTicketNumber: "A-103",
        departmentId: "services",
        departmentName: "الخدمات",
        counterId: "كاونتر 1",
        status: "completed",
        priorityCategory: "elderly",
        isPriority: true,
        priorityReason: "elderly",
        priorityAssignedByUserId: "staff-reception-01",
        customerName: "أبو فهد القحطاني",
        customerPhone: "0559876543",
        waitEstimateMinutes: 0,
        calledAt: subMinutes(12),
        servedAt: subMinutes(11),
        completedAt: subMinutes(4),
        createdAt: subMinutes(28),
        updatedAt: subMinutes(4),
      },
      {
        id: "seed-t-3",
        tenantSlug: "default",
        ticketNumber: "A-108",
        departmentId: "contracts",
        departmentName: "العقود",
        counterId: "كاونتر 2",
        status: "completed",
        priorityCategory: "none",
        isPriority: false,
        customerName: "محمد الشهري",
        customerPhone: "0543219876",
        waitEstimateMinutes: 0,
        calledAt: subMinutes(16),
        completedAt: subMinutes(7),
        createdAt: subMinutes(35),
        updatedAt: subMinutes(7),
      },
      {
        id: "seed-t-4",
        tenantSlug: "default",
        ticketNumber: "B-201",
        departmentId: "finance",
        departmentName: "المالية",
        counterId: "كاونتر 4",
        status: "completed",
        priorityCategory: "none",
        isPriority: false,
        customerName: "فاطمة الدوسري",
        waitEstimateMinutes: 0,
        calledAt: subMinutes(22),
        completedAt: subMinutes(13),
        createdAt: subMinutes(40),
        updatedAt: subMinutes(13),
      },
      {
        id: "seed-t-5",
        tenantSlug: "default",
        ticketNumber: "A-105",
        departmentId: "contracts",
        departmentName: "العقود",
        counterId: "كاونتر 3",
        status: "completed",
        priorityCategory: "none",
        isPriority: false,
        waitEstimateMinutes: 0,
        calledAt: subMinutes(28),
        completedAt: subMinutes(20),
        createdAt: subMinutes(45),
        updatedAt: subMinutes(20),
      },
      {
        id: "seed-t-6",
        tenantSlug: "default",
        ticketNumber: "P-105",
        originalTicketNumber: "A-109",
        departmentId: "services",
        departmentName: "الخدمات",
        status: "waiting",
        priorityCategory: "elderly",
        isPriority: true,
        priorityReason: "elderly",
        priorityAssignedByUserId: "staff-reception-01",
        customerName: "عبدالله السالم",
        customerPhone: "0533344455",
        waitEstimateMinutes: 4,
        createdAt: subMinutes(8),
        updatedAt: subMinutes(5),
      },
      {
        id: "seed-t-7",
        tenantSlug: "default",
        ticketNumber: "A-110",
        departmentId: "contracts",
        departmentName: "العقود",
        status: "waiting",
        priorityCategory: "none",
        isPriority: false,
        customerName: "سلطان الشمري",
        waitEstimateMinutes: 7,
        createdAt: subMinutes(6),
        updatedAt: subMinutes(6),
      },
      {
        id: "seed-t-8",
        tenantSlug: "default",
        ticketNumber: "A-111",
        departmentId: "finance",
        departmentName: "المالية",
        status: "waiting",
        priorityCategory: "none",
        isPriority: false,
        customerName: "نورة المطيري",
        waitEstimateMinutes: 11,
        createdAt: subMinutes(3),
        updatedAt: subMinutes(3),
      },
    ];

    seedTickets.forEach((t) => store.tickets.set(t.id, t));
    store.ticketCounter.set("default", 112);
    store.priorityCounter.set("default", 106);
    store.consecutivePriorityCalls.set("default", 1);

    // Seed default intake configs for common departments
    const defaultDepartments = [
      { id: "reception", name: "الاستقبال العام", cap: 120, buffer: 25 },
      { id: "contracts", name: "قسم العقود", cap: 100, buffer: 20 },
      { id: "finance", name: "قسم المالية", cap: 80, buffer: 15 },
      { id: "services", name: "خدمات المستفيدين", cap: 100, buffer: 25 },
    ];

    defaultDepartments.forEach((dept) => {
      const configKey = `default:${dept.id}`;
      store.intakeConfigs.set(configKey, {
        serviceId: dept.id,
        tenantSlug: "default",
        name: dept.name,
        departmentId: dept.id,
        maxDailyCapacity: dept.cap,
        maxActiveWaitingLimit: dept.buffer,
        avgServiceTimeMinutes: 15,
        autoIntakeEnabled: true,
        manualOverrideActive: false,
        isIntakeOpen: true,
      });

      // Schedules: Sun-Thu 08:00 - 16:00
      const schedList: ServiceSchedule[] = [];
      for (let day = 0; day <= 6; day++) {
        schedList.push({
          serviceId: dept.id,
          dayOfWeek: day,
          openingTime: "08:00",
          closingTime: "16:00",
          isWorkingDay: day >= 0 && day <= 4, // 0: Sun to 4: Thu are working days
          avgServiceTimeMinutes: 15,
        });
      }
      store.schedules.set(configKey, schedList);
    });

    // Default registered public screen
    store.screens.set("screen-central-tv-1", {
      id: "screen-central-tv-1",
      tenantSlug: "default",
      screenName: "شاشة الصالة المركزية الرئيسية",
      screenToken: "central-hall-tv-token",
      displaySettings: {
        audioAlert: true,
        theme: "dark",
        visibleServices: ["all"],
        recentCallsLimit: 5,
      },
      isOnline: true,
      lastPingAt: new Date().toISOString(),
      createdAt: subMinutes(120),
    });

    globalThis.__mken_queue_store__ = store;
  }

  if (!globalThis.__mken_queue_store__.pendingStaff) {
    globalThis.__mken_queue_store__.pendingStaff = new Map();
    globalThis.__mken_queue_store__.counterLocks = new Map();
    globalThis.__mken_queue_store__.customQueues = new Map();
    globalThis.__mken_queue_store__.queueListeners = new Set();
  }
  return globalThis.__mken_queue_store__;
}

/**
 * Multi-Tenant Helper: Resolves the tenant from request URL or headers.
 */
export function resolveTenantFromRequest(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant") || url.searchParams.get("store") || url.searchParams.get("slug");
  if (fromQuery && fromQuery.trim()) {
    return fromQuery.trim().toLowerCase();
  }

  const hostname = hostnameFromHeaders(request.headers);
  const fromSubdomain = tenantSlugFromSubdomain(hostname);
  if (fromSubdomain) return fromSubdomain.toLowerCase();

  const fromCustom = slugFromCustomHostname(hostname);
  if (fromCustom) return fromCustom.toLowerCase();

  return "default";
}

/** Format ticket letter & phonetic arabic text for Text-to-Speech (TTS) */
export function formatArabicTTS(ticketNumber: string, counterName: string): string {
  const cleanNumber = ticketNumber.trim();
  const letter = cleanNumber.charAt(0).toUpperCase();
  const digits = cleanNumber.replace(/^[A-Za-z]-?/, "");

  const letterNames: Record<string, string> = {
    P: "بي",
    A: "ألف",
    B: "باء",
    C: "جيم",
    D: "دال",
    E: "هاء",
  };

  const arabicLetter = letterNames[letter] || letter;
  const num = parseInt(digits, 10);
  let spokenNumber = digits;

  if (!isNaN(num)) {
    if (num >= 100 && num < 200) {
      const remainder = num - 100;
      if (remainder === 0) spokenNumber = "مئة";
      else if (remainder === 1) spokenNumber = "مئة وواحد";
      else if (remainder === 2) spokenNumber = "مئة واثنان";
      else if (remainder === 3) spokenNumber = "مئة وثلاثة";
      else if (remainder === 4) spokenNumber = "مئة وأربعة";
      else if (remainder === 5) spokenNumber = "مئة وخمسة";
      else if (remainder === 6) spokenNumber = "مئة وستة";
      else if (remainder === 7) spokenNumber = "مئة وسبعة";
      else if (remainder === 8) spokenNumber = "مئة وثمانية";
      else if (remainder === 9) spokenNumber = "مئة وتسعة";
      else if (remainder === 10) spokenNumber = "مئة وعشرة";
      else spokenNumber = `مئة و${remainder}`;
    } else if (num >= 200 && num < 300) {
      const remainder = num - 200;
      spokenNumber = remainder === 0 ? "مئتان" : `مئتان و${remainder}`;
    }
  }

  const counterClean = counterName.replace(/كاونتر\s*/, "كاونتر ");
  return `تذكرة ${arabicLetter} ${spokenNumber}، ${counterClean}`;
}

// =============================================================================
// Semi-Automated Intake Engine (محرك الإغلاق النصف آلي)
// =============================================================================

export function getServiceIntakeConfig(tenantSlug: string, serviceId: string): ServiceIntakeConfig {
  const store = getMemoryStore();
  const key = `${tenantSlug}:${serviceId}`;
  let config = store.intakeConfigs.get(key);
  if (!config) {
    config = {
      serviceId,
      tenantSlug,
      name: serviceId === "contracts" ? "قسم العقود" : serviceId === "finance" ? "قسم المالية" : "الاستقبال العام",
      departmentId: serviceId,
      maxDailyCapacity: 100,
      maxActiveWaitingLimit: 25,
      avgServiceTimeMinutes: 15,
      autoIntakeEnabled: true,
      manualOverrideActive: false,
      isIntakeOpen: true,
    };
    store.intakeConfigs.set(key, config);
  }
  return config;
}

/**
 * Evaluates the Semi-Automated Intake Status in Real-Time:
 * 1. Manual Override check & auto-expiry cleanup.
 * 2. Operating Hours & Schedule check.
 * 3. Predictive EOD Cut-off: Cut-off = Shift End - (Waiting × Avg Service Time).
 * 4. Dynamic Capacity (with recycling of cancelled and no_show tickets).
 * 5. Active Waiting Buffer Limit in the hall.
 */
export async function evaluateIntakeStatus(
  tenantSlug: string = "default",
  serviceId: string = "reception"
): Promise<IntakeEvaluation> {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const cleanService = (serviceId || "reception").trim();
  const store = getMemoryStore();
  const config = getServiceIntakeConfig(cleanTenant, cleanService);

  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Manual Override Check & Auto-Expiration
  if (config.manualOverrideActive) {
    if (config.manualOverrideExpiresAt && new Date(config.manualOverrideExpiresAt) <= now) {
      // Override expired: revert to automated system!
      config.manualOverrideActive = false;
      config.manualOverrideExpiresAt = null;
      config.manualOverrideType = null;
      config.manualOverrideReason = null;
    } else {
      // Respect manual decision until expiry
      const remainingMs = config.manualOverrideExpiresAt
        ? new Date(config.manualOverrideExpiresAt).getTime() - now.getTime()
        : null;
      const remainingMinutes = remainingMs ? Math.max(1, Math.round(remainingMs / 60000)) : null;

      const overrideReasonType: CloseReasonType =
        config.manualOverrideType === "pause"
          ? "manual_pause"
          : config.manualOverrideType === "emergency_close"
          ? "manual_emergency"
          : "none";

      const isOpen = config.isIntakeOpen;
      const closeReason = config.closedReason || "تدخل إداري مباشر";

      return {
        serviceId: cleanService,
        tenantSlug: cleanTenant,
        isOpen,
        closeReasonType: isOpen ? "none" : overrideReasonType,
        closeReason: isOpen ? "" : closeReason,
        contextMessage: isOpen ? CONTEXT_AWARE_MESSAGES.none : CONTEXT_AWARE_MESSAGES[overrideReasonType] || closeReason,
        stats: {
          todayIssued: 0,
          todayActive: 0,
          dailyCapacity: config.maxDailyCapacity,
          activeWaiting: 0,
          waitingBufferLimit: config.maxActiveWaitingLimit,
          avgServiceTimeMinutes: config.avgServiceTimeMinutes,
          predictiveCutoffTime: "15:30",
          closingTime: "16:00",
          openingTime: "08:00",
          isWorkingDay: true,
        },
        manualOverride: {
          active: true,
          type: config.manualOverrideType,
          expiresAt: config.manualOverrideExpiresAt,
          remainingMinutes,
          reason: config.manualOverrideReason,
        },
        autoIntakeEnabled: config.autoIntakeEnabled,
      };
    }
  }

  // If automation is explicitly disabled, maintain manual status
  if (!config.autoIntakeEnabled) {
    return {
      serviceId: cleanService,
      tenantSlug: cleanTenant,
      isOpen: config.isIntakeOpen,
      closeReasonType: config.isIntakeOpen ? "none" : "manual_emergency",
      closeReason: config.closedReason || "الأتمتة معطلة يدوياً",
      contextMessage: config.isIntakeOpen ? CONTEXT_AWARE_MESSAGES.none : CONTEXT_AWARE_MESSAGES.manual_emergency,
      stats: {
        todayIssued: 0,
        todayActive: 0,
        dailyCapacity: config.maxDailyCapacity,
        activeWaiting: 0,
        waitingBufferLimit: config.maxActiveWaitingLimit,
        avgServiceTimeMinutes: config.avgServiceTimeMinutes,
        predictiveCutoffTime: "15:30",
        closingTime: "16:00",
        openingTime: "08:00",
        isWorkingDay: true,
      },
      manualOverride: { active: false },
      autoIntakeEnabled: false,
    };
  }

  // 2. Query schedules & calculate hours
  const scheduleKey = `${cleanTenant}:${cleanService}`;
  const schedules = store.schedules.get(scheduleKey) || [];
  const currentDayOfWeek = now.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  const todaySchedule = schedules.find((s) => s.dayOfWeek === currentDayOfWeek) || {
    serviceId: cleanService,
    dayOfWeek: currentDayOfWeek,
    openingTime: "08:00",
    closingTime: "16:00",
    isWorkingDay: currentDayOfWeek >= 0 && currentDayOfWeek <= 4, // Sun-Thu
    avgServiceTimeMinutes: config.avgServiceTimeMinutes || 15,
  };

  const isWorkingDay = todaySchedule.isWorkingDay;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = todaySchedule.openingTime.split(":").map(Number);
  const [closeH, closeM] = todaySchedule.closingTime.split(":").map(Number);
  const openingMinutes = openH * 60 + openM;
  const closingMinutes = closeH * 60 + closeM;

  // 3. Query tenant tickets for this service
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const allServiceTickets = Array.from(store.tickets.values()).filter(
    (t) => t.tenantSlug === cleanTenant && t.departmentId === cleanService
  );

  const todayTickets = allServiceTickets.filter((t) => t.createdAt >= startOfDay);
  const todayIssued = todayTickets.length;

  // Capacity Recycling: Cancelled and No-Show tickets are completely recycled!
  const todayActive = todayTickets.filter((t) => t.status !== "cancelled" && t.status !== "no_show").length;
  const activeWaiting = allServiceTickets.filter((t) => t.status === "waiting").length;

  // 4. Predictive EOD Cut-off Calculation
  // Cut-off Time = Shift End Time - (Waiting Tickets × Average Service Time)
  const avgServiceTime = config.avgServiceTimeMinutes || 15;
  const accumulatedWaitingMinutes = activeWaiting * avgServiceTime;
  const predictiveCutoffMinutes = Math.max(openingMinutes, closingMinutes - accumulatedWaitingMinutes);

  const cutoffH = Math.floor(predictiveCutoffMinutes / 60);
  const cutoffM = predictiveCutoffMinutes % 60;
  const predictiveCutoffTime = `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;

  let isOpen = true;
  let closeReasonType: CloseReasonType = "none";
  let closeReason = "";

  // Check 1: Working day & Operating Hours
  if (!isWorkingDay || currentMinutes < openingMinutes || currentMinutes >= closingMinutes) {
    isOpen = false;
    closeReasonType = "schedule";
    closeReason = "خارج أوقات العمل الرسمية";
  }
  // Check 2: Predictive EOD Cut-off
  else if (currentMinutes >= predictiveCutoffMinutes) {
    isOpen = false;
    closeReasonType = "predictive_cutoff";
    closeReason = "اقتراب نهاية الدوام الرسمي وتراكم وقت الانتظار";
  }
  // Check 3: Dynamic Daily Capacity (Quota)
  else if (todayActive >= config.maxDailyCapacity) {
    isOpen = false;
    closeReasonType = "capacity";
    closeReason = "اكتملت الطاقة الاستيعابية المتاحة لهذا اليوم";
  }
  // Check 4: Hall Waiting Buffer Limit (Temporary Throttle)
  else if (activeWaiting >= config.maxActiveWaitingLimit) {
    isOpen = false;
    closeReasonType = "buffer";
    closeReason = "ضغط مرتفع في صالة الانتظار حالياً، جاري تخفيف الازدحام";
  }

  // Update config state
  config.isIntakeOpen = isOpen;
  config.closedReason = isOpen ? null : closeReason;
  store.intakeConfigs.set(`${cleanTenant}:${cleanService}`, config);

  return {
    serviceId: cleanService,
    tenantSlug: cleanTenant,
    isOpen,
    closeReasonType,
    closeReason,
    contextMessage: CONTEXT_AWARE_MESSAGES[closeReasonType],
    stats: {
      todayIssued,
      todayActive,
      dailyCapacity: config.maxDailyCapacity,
      activeWaiting,
      waitingBufferLimit: config.maxActiveWaitingLimit,
      avgServiceTimeMinutes: avgServiceTime,
      predictiveCutoffTime,
      closingTime: todaySchedule.closingTime,
      openingTime: todaySchedule.openingTime,
      isWorkingDay,
    },
    manualOverride: { active: false },
    autoIntakeEnabled: config.autoIntakeEnabled,
  };
}

/**
 * Applies Rapid Staff / Supervisor Manual Overrides
 */
export async function applyManualOverride(options: {
  tenantSlug?: string;
  serviceId?: string;
  action: "add_capacity" | "extend_time" | "pause_intake" | "emergency_close" | "reset_override" | "toggle_automation";
  value?: number;
  staffUserId?: string;
  reason?: string;
}): Promise<IntakeEvaluation> {
  const cleanTenant = (options.tenantSlug || "default").trim().toLowerCase();
  const cleanService = (options.serviceId || "reception").trim();
  const store = getMemoryStore();
  const config = getServiceIntakeConfig(cleanTenant, cleanService);

  const now = new Date();

  switch (options.action) {
    case "add_capacity": {
      const boost = options.value || 10;
      config.maxDailyCapacity += boost;
      config.manualOverrideReason = `زيادة سعة استثنائية (+${boost} تذكرة)`;
      break;
    }
    case "extend_time": {
      const minutes = options.value || 30;
      config.manualOverrideActive = true;
      config.manualOverrideType = "extend_time";
      config.manualOverrideExpiresAt = new Date(now.getTime() + minutes * 60000).toISOString();
      config.manualOverrideReason = `تمديد وقت استقبال المراجعين (+${minutes} دقيقة)`;
      config.isIntakeOpen = true;
      config.closedReason = null;
      break;
    }
    case "pause_intake": {
      const minutes = options.value || 15;
      config.manualOverrideActive = true;
      config.manualOverrideType = "pause";
      config.manualOverrideExpiresAt = new Date(now.getTime() + minutes * 60000).toISOString();
      config.manualOverrideReason = `إيقاف استقبال مؤقت (${minutes} دقيقة) لتنظيم الصالة`;
      config.isIntakeOpen = false;
      config.closedReason = "إيقاف مؤقت لتخفيف الضغط";
      break;
    }
    case "emergency_close": {
      // Until end of today
      const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      config.manualOverrideActive = true;
      config.manualOverrideType = "emergency_close";
      config.manualOverrideExpiresAt = eod;
      config.manualOverrideReason = options.reason || "إغلاق إداري إجباري لليوم";
      config.isIntakeOpen = false;
      config.closedReason = "تم إغلاق الاستقبال لليوم بقرار إداري";
      break;
    }
    case "reset_override": {
      config.manualOverrideActive = false;
      config.manualOverrideExpiresAt = null;
      config.manualOverrideType = null;
      config.manualOverrideReason = null;
      break;
    }
    case "toggle_automation": {
      config.autoIntakeEnabled = !config.autoIntakeEnabled;
      break;
    }
  }

  store.intakeConfigs.set(`${cleanTenant}:${cleanService}`, config);
  return evaluateIntakeStatus(cleanTenant, cleanService);
}

/** Get the current live queue state for a tenant (STRICT TENANT ISOLATION) */
export async function getQueueState(tenantSlug: string = "default"): Promise<QueueState> {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();
  const db = getServiceRoleDb();

  if (db) {
    try {
      const { data: ticketsData, error } = await db
        .from("tickets")
        .select("*")
        .eq("tenant_slug", cleanTenant)
        .order("created_at", { ascending: true });

      if (!error && ticketsData && ticketsData.length > 0) {
        const mapped: Ticket[] = ticketsData.map((r: any) => ({
          id: r.id,
          tenantSlug: r.tenant_slug || cleanTenant,
          branchId: r.branch_id || null,
          customerId: r.customer_id || null,
          ticketNumber: r.ticket_number,
          originalTicketNumber: r.original_ticket_number || null,
          departmentId: r.department_id || "reception",
          departmentName: r.department_name || "الاستقبال",
          counterId: r.counter_id || null,
          status: r.status,
          priorityCategory: (r.priority_category as PriorityCategory) || "none",
          priorityAssignedByUserId: r.priority_assigned_by_user_id || null,
          isPriority: Boolean(r.is_priority || r.priority_category !== "none"),
          priorityReason: r.priority_reason || null,
          customerName: r.customer_name || null,
          customerPhone: r.customer_phone || null,
          waitEstimateMinutes: r.wait_estimate_minutes || 0,
          calledAt: r.called_at || null,
          servedAt: r.served_at || null,
          completedAt: r.completed_at || null,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        }));

        const nowCalling =
          mapped
            .filter((t) => t.status === "calling" || t.status === "serving")
            .sort((a, b) => new Date(b.calledAt || b.updatedAt).getTime() - new Date(a.calledAt || a.updatedAt).getTime())[0] ||
          null;

        const recentCalls = mapped
          .filter((t) => (t.status === "completed" || t.status === "calling") && t.id !== nowCalling?.id)
          .sort((a, b) => new Date(b.calledAt || b.completedAt || b.updatedAt).getTime() - new Date(a.calledAt || a.completedAt || a.updatedAt).getTime())
          .slice(0, 5);

        const waitingTickets = mapped.filter((t) => t.status === "waiting");

        const { data: dispatchData } = await db
          .from("queue_dispatch_state")
          .select("consecutive_priority_calls")
          .eq("tenant_slug", cleanTenant)
          .maybeSingle();

        const consecutive = dispatchData?.consecutive_priority_calls ?? 0;

        return {
          tenantSlug: cleanTenant,
          nowCalling,
          recentCalls,
          waitingTickets,
          consecutivePriorityCalls: consecutive,
          stats: {
            totalWaiting: waitingTickets.length,
            priorityWaiting: waitingTickets.filter((t) => t.priorityCategory !== "none").length,
            standardWaiting: waitingTickets.filter((t) => t.priorityCategory === "none").length,
            activeCounters: new Set(mapped.filter((t) => t.counterId && t.status !== "completed").map((t) => t.counterId)).size || 3,
          },
        };
      }
    } catch {
      // Fallback to memory store below
    }
  }

  // Memory store fallback with strict tenant isolation
  const allTickets = Array.from(store.tickets.values()).filter((t) => t.tenantSlug === cleanTenant);

  const nowCalling =
    allTickets
      .filter((t) => t.status === "calling" || t.status === "serving")
      .sort((a, b) => new Date(b.calledAt || b.updatedAt).getTime() - new Date(a.calledAt || a.updatedAt).getTime())[0] ||
    null;

  const recentCalls = allTickets
    .filter((t) => (t.status === "completed" || t.status === "calling") && t.id !== nowCalling?.id)
    .sort((a, b) => new Date(b.calledAt || b.completedAt || b.updatedAt).getTime() - new Date(a.calledAt || a.completedAt || a.updatedAt).getTime())
    .slice(0, 5);

  const waitingTickets = allTickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const consecutive = store.consecutivePriorityCalls.get(cleanTenant) || 0;

  return {
    tenantSlug: cleanTenant,
    nowCalling,
    recentCalls,
    waitingTickets,
    consecutivePriorityCalls: consecutive,
    stats: {
      totalWaiting: waitingTickets.length,
      priorityWaiting: waitingTickets.filter((t) => t.priorityCategory !== "none").length,
      standardWaiting: waitingTickets.filter((t) => t.priorityCategory === "none").length,
      activeCounters: new Set(allTickets.filter((t) => t.counterId && t.status !== "completed").map((t) => t.counterId)).size || 3,
    },
  };
}

/**
 * 1. Issue Ticket with Semi-Automated Intake Verification:
 * - Checks whether intake is open for the department before accepting public issuance.
 * - Links customerId with CRM.
 * - Public QR self-service strictly issues 'none' (Standard).
 */
export async function issueTicket(options: {
  tenantSlug?: string;
  departmentId?: string;
  departmentName?: string;
  customerName?: string;
  customerPhone?: string;
  priorityCategory?: PriorityCategory;
  staffUserId?: string | null;
}): Promise<Ticket> {
  const store = getMemoryStore();
  const tenantSlug = (options.tenantSlug || "default").trim().toLowerCase();
  const departmentId = options.departmentId || "reception";
  const departmentName =
    options.departmentName ||
    (departmentId === "contracts" ? "العقود" : departmentId === "finance" ? "المالية" : "الاستقبال");

  const isStaff = Boolean(options.staffUserId);

  // Check Intake Engine if issued by customer/self-service QR
  if (!isStaff) {
    const intakeStatus = await evaluateIntakeStatus(tenantSlug, departmentId);
    if (!intakeStatus.isOpen) {
      throw new Error(intakeStatus.contextMessage || "الاستقبال مغلق حالياً لهذا القسم");
    }
  }

  // Format customer phone
  const rawPhone = (options.customerPhone || "").trim();
  const cleanPhone = rawPhone.replace(/[^\d+]/g, "");

  // 1. Connect with Mken Customer List (CRM Profile Lookup)
  let customerProfile: CustomerProfile | null = null;
  let customerId: string | null = null;

  if (cleanPhone) {
    const custKey = `${tenantSlug}:${cleanPhone}`;
    const existing = store.customers.get(custKey);

    if (existing) {
      customerProfile = {
        ...existing,
        visitCount: existing.visitCount + 1,
        lastVisitedAt: new Date().toISOString(),
      };
      if (options.customerName && !existing.name) customerProfile.name = options.customerName;
      store.customers.set(custKey, customerProfile);
      customerId = customerProfile.id;
    } else {
      // New walk-in customer: auto-register in Mken Customers CRM
      customerId = `cust-${Date.now()}-${cleanPhone.slice(-4)}`;
      customerProfile = {
        id: customerId,
        tenantSlug,
        name: options.customerName || "عميل صالة",
        phone: cleanPhone,
        visitCount: 1,
        lastVisitedAt: new Date().toISOString(),
      };
      store.customers.set(custKey, customerProfile);
    }
  }

  let requestedPriority: PriorityCategory = isStaff ? options.priorityCategory || "none" : "none";

  if (isStaff && requestedPriority === "none" && customerProfile) {
    if (customerProfile.isKnownSenior) requestedPriority = "elderly";
    else if (customerProfile.isKnownSpecialNeeds) requestedPriority = "special_needs";
  }

  const nextSeq =
    (requestedPriority !== "none"
      ? store.priorityCounter.get(tenantSlug)
      : store.ticketCounter.get(tenantSlug)) || 100;

  if (requestedPriority !== "none") {
    store.priorityCounter.set(tenantSlug, nextSeq + 1);
  } else {
    store.ticketCounter.set(tenantSlug, nextSeq + 1);
  }

  const prefix = requestedPriority !== "none" ? "P" : departmentId === "finance" ? "B" : "A";
  const ticketNumber = `${prefix}-${nextSeq}`;

  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantSlug,
    customerId,
    customerProfile,
    ticketNumber,
    departmentId,
    departmentName,
    status: "waiting",
    priorityCategory: requestedPriority,
    isPriority: requestedPriority !== "none",
    priorityReason: requestedPriority !== "none" ? requestedPriority : null,
    priorityAssignedByUserId: isStaff && requestedPriority !== "none" ? options.staffUserId : null,
    customerName: options.customerName || customerProfile?.name || null,
    customerPhone: cleanPhone || null,
    waitEstimateMinutes: requestedPriority !== "none" ? 5 : 15,
    createdAt: now,
    updatedAt: now,
  };

  store.tickets.set(ticket.id, ticket);

  // Sync with Supabase if database is available
  const db = getServiceRoleDb();
  if (db) {
    try {
      if (cleanPhone) {
        await db.from("mken_customers").upsert(
          {
            id: customerId,
            tenant_slug: tenantSlug,
            name: ticket.customerName || "عميل الصالة",
            phone: cleanPhone,
            updated_at: now,
          },
          { onConflict: "tenant_slug,phone" }
        );
      }

      await db.from("tickets").insert({
        id: ticket.id,
        tenant_slug: ticket.tenantSlug,
        customer_id: ticket.customerId,
        ticket_number: ticket.ticketNumber,
        department_id: ticket.departmentId,
        department_name: ticket.departmentName,
        status: ticket.status,
        priority_category: ticket.priorityCategory,
        is_priority: ticket.isPriority,
        priority_reason: ticket.priorityReason,
        priority_assigned_by_user_id: ticket.priorityAssignedByUserId,
        customer_name: ticket.customerName,
        customer_phone: ticket.customerPhone,
        wait_estimate_minutes: ticket.waitEstimateMinutes,
        created_at: ticket.createdAt,
        updated_at: ticket.updatedAt,
      });
    } catch {
      // Retained in memory store
    }
  }

  return ticket;
}

/**
 * 2. Staff-Controlled Priority Upgrade / Override:
 */
export async function updateTicketPriority(options: {
  ticketId: string;
  priorityCategory: PriorityCategory;
  staffUserId: string;
  reason?: string;
  tenantSlug?: string;
}): Promise<{ ticket: Ticket; message: string }> {
  const store = getMemoryStore();
  const ticket = store.tickets.get(options.ticketId);

  if (!ticket) {
    throw new Error(`التذكرة غير موجودة: ${options.ticketId}`);
  }

  const now = new Date().toISOString();
  ticket.priorityCategory = options.priorityCategory;
  ticket.priorityAssignedByUserId = options.staffUserId;
  ticket.updatedAt = now;

  if (options.priorityCategory !== "none") {
    ticket.isPriority = true;
    ticket.priorityReason = options.reason || options.priorityCategory;

    if (!ticket.originalTicketNumber && !ticket.ticketNumber.startsWith("P-")) {
      ticket.originalTicketNumber = ticket.ticketNumber;
      const numPart = ticket.ticketNumber.replace(/^[A-Za-z]-?/, "");
      ticket.ticketNumber = `P-${numPart}`;
    }
    ticket.waitEstimateMinutes = Math.min(ticket.waitEstimateMinutes, 4);

    if (ticket.customerPhone) {
      const custKey = `${ticket.tenantSlug}:${ticket.customerPhone}`;
      const cust = store.customers.get(custKey);
      if (cust) {
        if (options.priorityCategory === "elderly") cust.isKnownSenior = true;
        if (options.priorityCategory === "special_needs") cust.isKnownSpecialNeeds = true;
        cust.notes = `تم اعتماد مسار ${options.priorityCategory === "elderly" ? "كبار السن" : "الاحتياجات الخاصة"}`;
        store.customers.set(custKey, cust);
      }
    }
  } else {
    ticket.isPriority = false;
    ticket.priorityReason = null;
    if (ticket.originalTicketNumber) {
      ticket.ticketNumber = ticket.originalTicketNumber;
      ticket.originalTicketNumber = null;
    }
  }

  store.tickets.set(ticket.id, ticket);

  const db = getServiceRoleDb();
  if (db) {
    try {
      await db
        .from("tickets")
        .update({
          ticket_number: ticket.ticketNumber,
          original_ticket_number: ticket.originalTicketNumber,
          priority_category: ticket.priorityCategory,
          is_priority: ticket.isPriority,
          priority_reason: ticket.priorityReason,
          priority_assigned_by_user_id: ticket.priorityAssignedByUserId,
          wait_estimate_minutes: ticket.waitEstimateMinutes,
          updated_at: ticket.updatedAt,
        })
        .eq("id", ticket.id);
    } catch {
      // fallback in memory
    }
  }

  const label =
    options.priorityCategory === "elderly"
      ? "كبار السن 👴"
      : options.priorityCategory === "special_needs"
      ? "ذوي الاحتياجات الخاصة ♿"
      : "المسار العادي";

  const message =
    options.priorityCategory !== "none"
      ? `تمت ترقية تذكرتك إلى مسار الرعاية الخاصة (${label}) بنجاح`
      : `تمت استعادة التذكرة إلى المسار العادي`;

  return { ticket, message };
}

/**
 * 3. Anti-Starvation Dispatcher Algorithm (2:1 Weighted Round-Robin)
 */
export async function callNextTicket(options: {
  tenantSlug?: string;
  counterId: string;
  departmentId?: string;
  staffUserId?: string;
}): Promise<{
  ticket: Ticket | null;
  consecutivePriorityCalls: number;
  dispatchReason: string;
}> {
  const store = getMemoryStore();
  const tenantSlug = (options.tenantSlug || "default").trim().toLowerCase();

  const waiting = Array.from(store.tickets.values())
    .filter((t) => t.tenantSlug === tenantSlug && t.status === "waiting")
    .filter((t) => (!options.departmentId || options.departmentId === "all" ? true : t.departmentId === options.departmentId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (waiting.length === 0) {
    return {
      ticket: null,
      consecutivePriorityCalls: store.consecutivePriorityCalls.get(tenantSlug) || 0,
      dispatchReason: "لا توجد تذاكر في قائمة الانتظار حالياً",
    };
  }

  const priorityTickets = waiting.filter((t) => t.priorityCategory !== "none");
  const standardTickets = waiting.filter((t) => t.priorityCategory === "none");

  const currentConsecutive = store.consecutivePriorityCalls.get(tenantSlug) || 0;
  let selectedTicket: Ticket | null = null;
  let newConsecutive = currentConsecutive;
  let dispatchReason = "";

  if (priorityTickets.length > 0 && currentConsecutive < 2) {
    selectedTicket = priorityTickets[0];
    newConsecutive = currentConsecutive + 1;
    dispatchReason = `خدمة أولوية إنسانية (${selectedTicket.priorityCategory === "elderly" ? "كبار سن 👴" : "احتياجات خاصة ♿"}) - نداء ${newConsecutive} من 2`;
  } else if (standardTickets.length > 0) {
    selectedTicket = standardTickets[0];
    newConsecutive = 0;
    dispatchReason =
      currentConsecutive >= 2
        ? "استدعاء المسار العام إجبارياً بعد حالتي أولوية (خوارزمية الجدولة العادلة 2:1)"
        : "استدعاء تذكرة من المسار العام";
  } else if (priorityTickets.length > 0) {
    selectedTicket = priorityTickets[0];
    newConsecutive = 1;
    dispatchReason = "خدمة أولوية إنسانية (لا يوجد انتظار في المسار العام)";
  }

  if (!selectedTicket) {
    return {
      ticket: null,
      consecutivePriorityCalls: currentConsecutive,
      dispatchReason: "لا توجد تذاكر صالحة للاستدعاء",
    };
  }

  const now = new Date().toISOString();
  selectedTicket.status = "calling";
  selectedTicket.counterId = options.counterId;
  selectedTicket.calledAt = now;
  selectedTicket.updatedAt = now;

  store.tickets.set(selectedTicket.id, selectedTicket);
  store.consecutivePriorityCalls.set(tenantSlug, newConsecutive);

  const db = getServiceRoleDb();
  if (db) {
    try {
      await db
        .from("tickets")
        .update({
          status: "calling",
          counter_id: selectedTicket.counterId,
          called_at: selectedTicket.calledAt,
          updated_at: selectedTicket.updatedAt,
        })
        .eq("id", selectedTicket.id);

      await db.from("queue_dispatch_state").upsert({
        tenant_slug: tenantSlug,
        consecutive_priority_calls: newConsecutive,
        last_called_ticket_id: selectedTicket.id,
        updated_at: now,
      });
    } catch {
      // memory store updated
    }
  }

  return {
    ticket: selectedTicket,
    consecutivePriorityCalls: newConsecutive,
    dispatchReason,
  };
}

/**
 * Complete, Cancel, or Mark No-Show on ticket with Capacity Recycling
 */
export async function completeTicket(
  ticketId: string,
  newStatus: "completed" | "cancelled" | "no_show" = "completed"
): Promise<Ticket | null> {
  const store = getMemoryStore();
  const ticket = store.tickets.get(ticketId);
  if (!ticket) return null;

  const now = new Date().toISOString();
  ticket.status = newStatus;
  ticket.completedAt = now;
  ticket.updatedAt = now;
  store.tickets.set(ticket.id, ticket);

  const db = getServiceRoleDb();
  if (db) {
    try {
      await db
        .from("tickets")
        .update({
          status: newStatus,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", ticketId);
    } catch {
      // memory store
    }
  }

  // Capacity Recycling triggered: if cancelled or no_show, slot is instantly recycled
  if (newStatus === "cancelled" || newStatus === "no_show") {
    // Re-evaluates intake status automatically
    evaluateIntakeStatus(ticket.tenantSlug, ticket.departmentId).catch(() => {});
  }

  return ticket;
}

/** Keep-Alive Ping for Central TV Signage screens */
export async function pingDisplayScreen(options: {
  screenToken: string;
  screenName?: string;
  tenantSlug?: string;
}): Promise<DisplayScreen> {
  const store = getMemoryStore();
  const token = options.screenToken || "central-tv-default";
  const tenantSlug = (options.tenantSlug || "default").trim().toLowerCase();
  const now = new Date().toISOString();

  let screen = store.screens.get(token);
  if (!screen) {
    screen = {
      id: `screen-${token}`,
      tenantSlug,
      screenName: options.screenName || "شاشة الصالة المركزية",
      screenToken: token,
      displaySettings: {
        audioAlert: true,
        theme: "dark",
        visibleServices: ["all"],
        recentCallsLimit: 5,
      },
      isOnline: true,
      lastPingAt: now,
      createdAt: now,
    };
  } else {
    screen.isOnline = true;
    screen.lastPingAt = now;
    screen.tenantSlug = tenantSlug;
    if (options.screenName) screen.screenName = options.screenName;
  }

  store.screens.set(token, screen);

  const db = getServiceRoleDb();
  if (db) {
    try {
      await db.from("display_screens").upsert({
        tenant_slug: screen.tenantSlug,
        screen_name: screen.screenName,
        screen_token: screen.screenToken,
        display_settings: screen.displaySettings,
        is_online: true,
        last_ping_at: now,
      });
    } catch {
      // memory fallback
    }
  }

  return screen;
}


// ============================================================================
// 5 Architectural Safeguards: Onboarding, Counter Mutex, Dynamic Queues & Broadcast
// ============================================================================

/** Broadcast event to connected screens & SSE listeners */
export function broadcastQueueEvent(event: Omit<QueueBroadcastEvent, "timestamp">): void {
  const store = getMemoryStore();
  const fullEvent: QueueBroadcastEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  store.queueListeners.forEach((listener) => {
    try {
      listener(fullEvent);
    } catch {
      // listener error ignore
    }
  });
}

/** Subscribe to live queue events */
export function subscribeToQueueEvents(listener: (event: QueueBroadcastEvent) => void): () => void {
  const store = getMemoryStore();
  store.queueListeners.add(listener);
  return () => {
    store.queueListeners.delete(listener);
  };
}

/**
 * 1. Pairing Handshake Protocol:
 * Staff scans QR, submits name & phone. Server returns a 2-digit pairing code (valid for 5 mins).
 */
export async function requestStaffJoin(
  tenantSlug: string,
  name: string,
  phone: string
): Promise<{ success: boolean; staff?: OnboardingStaff; error?: string }> {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const cleanName = (name || "").trim();
  const cleanPhone = (phone || "").trim().replace(/\D/g, "");

  if (!cleanName) return { success: false, error: "اسم الموظف مطلوب" };
  if (cleanPhone.length < 9) return { success: false, error: "رقم الجوال غير صحيح" };

  const store = getMemoryStore();

  // Check if there is already an active pending request for this phone
  const existingPending = Array.from(store.pendingStaff.values()).find(
    (s) => s.tenantSlug === cleanTenant && s.phone === cleanPhone && s.onboardingStatus === "pending_approval"
  );

  const now = Date.now();
  if (existingPending && new Date(existingPending.pairingCodeExpiresAt).getTime() > now) {
    // Return existing active pairing code
    return { success: true, staff: existingPending };
  }

  // Generate 2-digit pairing code (10 - 99)
  const pairingCode = String(Math.floor(10 + Math.random() * 90));
  const pairingCodeExpiresAt = new Date(now + 5 * 60 * 1000).toISOString();
  const staffId = `staff_req_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const staff: OnboardingStaff = {
    id: staffId,
    tenantSlug: cleanTenant,
    name: cleanName,
    phone: cleanPhone,
    pairingCode,
    pairingCodeExpiresAt,
    onboardingStatus: "pending_approval",
    createdAt: new Date().toISOString(),
  };

  store.pendingStaff.set(staffId, staff);

  broadcastQueueEvent({
    type: "STAFF_JOIN_REQUESTED",
    tenantSlug: cleanTenant,
    data: {
      staffId: staff.id,
      name: staff.name,
      phone: staff.phone,
      pairingCode: staff.pairingCode,
    },
  });

  return { success: true, staff };
}

/** Get all currently pending staff requests for a tenant */
export function getPendingStaff(tenantSlug: string): OnboardingStaff[] {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();
  const now = Date.now();

  return Array.from(store.pendingStaff.values()).filter(
    (s) =>
      s.tenantSlug === cleanTenant &&
      s.onboardingStatus === "pending_approval" &&
      new Date(s.pairingCodeExpiresAt).getTime() > now
  );
}

/** Check status of a staff member during mobile onboarding */
export function checkStaffOnboardingStatus(tenantSlug: string, staffId: string): OnboardingStaff | null {
  const store = getMemoryStore();
  const staff = store.pendingStaff.get(staffId);
  if (!staff || staff.tenantSlug !== (tenantSlug || "default").trim().toLowerCase()) return null;
  return staff;
}

/**
 * 2. Counter Mutex & Takeover + Admin Approval
 */
export async function approveAndAssignStaff(params: {
  tenantSlug: string;
  staffId: string;
  pairingCode: string;
  deskName: string;
  serviceId: string;
  role: "counter_agent" | "receptionist" | "supervisor";
  forceTakeover?: boolean;
  approvedBy: string;
}): Promise<{
  success: boolean;
  staff?: OnboardingStaff;
  sessionToken?: string;
  conflict?: boolean;
  currentStaff?: string;
  message?: string;
}> {
  const cleanTenant = (params.tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();
  const staff = store.pendingStaff.get(params.staffId);

  if (!staff || staff.tenantSlug !== cleanTenant) {
    return { success: false, message: "طلب انضمام الموظف غير موجود أو منتهي الصلاحية" };
  }

  // Verify Pairing Code
  if (params.pairingCode && params.pairingCode.trim() !== staff.pairingCode.trim()) {
    return { success: false, message: "كود التحقق والإقران غير متطابق مع هاتف الموظف" };
  }

  // Counter Mutex Check
  const lockKey = `${cleanTenant}:${params.deskName.trim()}`;
  const existingLock = store.counterLocks.get(lockKey);

  if (existingLock && existingLock.assignedStaffId !== params.staffId) {
    if (!params.forceTakeover) {
      return {
        success: false,
        conflict: true,
        currentStaff: existingLock.assignedStaffName,
        message: `الكاونتر "${params.deskName}" مسند حالياً للموظف "${existingLock.assignedStaffName}". هل ترغب في إنهاء جلسته وتسليم الكاونتر للموظف الجديد؟`,
      };
    } else {
      // Force Takeover: Disconnect previous staff
      const prevStaff = store.pendingStaff.get(existingLock.assignedStaffId);
      if (prevStaff) {
        prevStaff.onboardingStatus = "off_duty";
      }
      store.counterLocks.delete(lockKey);
    }
  }

  // Generate Session Token
  const sessionToken = `mkn_stf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();

  staff.onboardingStatus = "active";
  staff.assignedDeskName = params.deskName.trim();
  staff.assignedServiceId = params.serviceId.trim();
  staff.assignedRole = params.role;
  staff.sessionToken = sessionToken;
  staff.approvedAt = now;
  staff.approvedBy = params.approvedBy;

  // Set Counter Lock
  store.counterLocks.set(lockKey, {
    tenantSlug: cleanTenant,
    deskName: staff.assignedDeskName,
    serviceId: staff.assignedServiceId,
    assignedStaffId: staff.id,
    assignedStaffName: staff.name,
    lockedAt: now,
    lastHeartbeatAt: now,
  });

  broadcastQueueEvent({
    type: "STAFF_ASSIGNED",
    tenantSlug: cleanTenant,
    data: {
      staffId: staff.id,
      name: staff.name,
      deskName: staff.assignedDeskName,
      serviceId: staff.assignedServiceId,
      role: staff.assignedRole,
    },
  });

  return { success: true, staff, sessionToken };
}

/** Release counter lock when staff finishes shift */
export function releaseCounterLock(tenantSlug: string, deskName: string, staffId?: string): boolean {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();
  const lockKey = `${cleanTenant}:${deskName.trim()}`;
  const lock = store.counterLocks.get(lockKey);

  if (!lock) return false;
  if (staffId && lock.assignedStaffId !== staffId) return false;

  store.counterLocks.delete(lockKey);
  const staff = store.pendingStaff.get(lock.assignedStaffId);
  if (staff) {
    staff.onboardingStatus = "off_duty";
  }
  return true;
}

/** Get list of active counter locks */
export function getCounterLocks(tenantSlug: string): CounterLock[] {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();
  return Array.from(store.counterLocks.values()).filter((l) => l.tenantSlug === cleanTenant);
}

/**
 * 4. Dynamic Queue Broadcast & Cold-Start Buffer (±20% initial)
 */
export async function createCustomQueue(params: {
  tenantSlug: string;
  name: string;
  prefix?: string;
  avgServiceTimeMinutes?: number;
  maxDailyCapacity?: number;
  maxActiveWaitingLimit?: number;
  createdByAdmin?: string;
}): Promise<{ success: boolean; queue?: CustomQueueDefinition; message?: string }> {
  const cleanTenant = (params.tenantSlug || "default").trim().toLowerCase();
  const cleanName = (params.name || "").trim();
  if (!cleanName) return { success: false, message: "اسم الطابور / القسم مطلوب" };

  const store = getMemoryStore();
  const queueId = `queue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const prefix = (params.prefix || "Q").toUpperCase().slice(0, 3);
  
  // Cold-Start Buffer: 15 mins default with ±20% flexible initial buffer
  const avgTime = Math.max(5, Number(params.avgServiceTimeMinutes) || 15);
  const maxCap = Math.max(10, Number(params.maxDailyCapacity) || 100);
  const bufferLimit = Math.max(5, Number(params.maxActiveWaitingLimit) || 20);

  const customQueue: CustomQueueDefinition = {
    id: queueId,
    tenantSlug: cleanTenant,
    name: cleanName,
    prefix,
    avgServiceTimeMinutes: avgTime,
    maxDailyCapacity: maxCap,
    maxActiveWaitingLimit: bufferLimit,
    isActive: true,
    createdByAdmin: params.createdByAdmin || "admin@mken.live",
    createdAt: new Date().toISOString(),
  };

  // Register in memory store
  const existingList = store.customQueues.get(cleanTenant) || [];
  existingList.push(customQueue);
  store.customQueues.set(cleanTenant, existingList);

  // Register in intakeConfigs
  const configKey = `${cleanTenant}:${queueId}`;
  store.intakeConfigs.set(configKey, {
    serviceId: queueId,
    tenantSlug: cleanTenant,
    name: cleanName,
    departmentId: queueId,
    maxDailyCapacity: maxCap,
    maxActiveWaitingLimit: bufferLimit,
    avgServiceTimeMinutes: avgTime,
    autoIntakeEnabled: true,
    manualOverrideActive: false,
    isIntakeOpen: true,
  });

  // Create default schedules (Sun-Thu 08:00 - 16:00)
  const schedList: ServiceSchedule[] = [];
  for (let day = 0; day <= 6; day++) {
    schedList.push({
      serviceId: queueId,
      dayOfWeek: day,
      openingTime: "08:00",
      closingTime: "16:00",
      isWorkingDay: day >= 0 && day <= 4,
      avgServiceTimeMinutes: avgTime,
    });
  }
  store.schedules.set(configKey, schedList);

  // Broadcast to all listening screens and mobile clients
  broadcastQueueEvent({
    type: "SERVICE_CREATED",
    tenantSlug: cleanTenant,
    data: customQueue,
  });

  return { success: true, queue: customQueue };
}

/** Get all services (default + dynamically created) for a tenant */
export function getTenantServices(tenantSlug: string): Array<{
  id: string;
  name: string;
  prefix: string;
  avgServiceTimeMinutes: number;
  maxDailyCapacity: number;
  maxActiveWaitingLimit: number;
}> {
  const cleanTenant = (tenantSlug || "default").trim().toLowerCase();
  const store = getMemoryStore();

  const standard = [
    { id: "reception", name: "الاستقبال العام", prefix: "A", avgServiceTimeMinutes: 10, maxDailyCapacity: 120, maxActiveWaitingLimit: 25 },
    { id: "contracts", name: "قسم العقود", prefix: "A", avgServiceTimeMinutes: 15, maxDailyCapacity: 100, maxActiveWaitingLimit: 20 },
    { id: "finance", name: "قسم المالية", prefix: "B", avgServiceTimeMinutes: 12, maxDailyCapacity: 80, maxActiveWaitingLimit: 15 },
    { id: "services", name: "خدمات المستفيدين", prefix: "C", avgServiceTimeMinutes: 15, maxDailyCapacity: 100, maxActiveWaitingLimit: 25 },
  ];

  const custom = (store.customQueues.get(cleanTenant) || []).map((q) => ({
    id: q.id,
    name: q.name,
    prefix: q.prefix,
    avgServiceTimeMinutes: q.avgServiceTimeMinutes,
    maxDailyCapacity: q.maxDailyCapacity,
    maxActiveWaitingLimit: q.maxActiveWaitingLimit,
  }));

  return [...standard, ...custom];
}
