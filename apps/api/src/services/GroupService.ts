import { GroupRepository } from "../repositories/GroupRepository";
import { EventRepository } from "../repositories/EventRepository";
import logger from "../logger";


export const GroupService = {
  getAll: async (filters?: { dateRange?: string; env?: string; search?: string; level?: string; levels?: string[]; sort?: string; page?: number; limit?: number }, projectId?: string) => {
    logger.debug("Fetching error groups", { filters, projectId });
    return await GroupRepository.findAll(filters, projectId);
  },

  getById: async (fingerprint: string) => {
    logger.debug("Fetching error group by fingerprint", { fingerprint });
    const group = await GroupRepository.findByFingerprint(fingerprint);
    if (!group) {
      return null;
    }

    const firstEvent = await EventRepository.findFirstByFingerprint(fingerprint);
    if (firstEvent && firstEvent.createdAt < group.firstSeen) {
      return {
        ...group,
        firstSeen: firstEvent.createdAt,
      };
    }

    return group;
  },

  getEvents: async (fingerprint: string, page: number = 1, limit: number = 10) => {
    logger.debug("Fetching events for group", { fingerprint, page, limit });
    const events = await EventRepository.findByFingerprint(fingerprint, page, limit);
    const totalResult = await EventRepository.countByFingerprint(fingerprint);
    const total = totalResult?.count || 0;

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  },

  getTimeline: async (fingerprint: string) => {
    logger.debug("Fetching timeline for group", { fingerprint });
    const group = await GroupRepository.findByFingerprint(fingerprint);
    if (!group) {
      return [];
    }

    const events = await EventRepository.findByFingerprint(fingerprint, 1, 10000);
    const timeline: { date: string; count: number }[] = [];
    const dateMap = new Map<string, number>();

    events.forEach((event) => {
      const dateKey = event.createdAt.toISOString().split("T")[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });

    const startDate = new Date(group.firstSeen);
    const endDate = new Date();
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      timeline.push({
        date: dateKey,
        count: dateMap.get(dateKey) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return timeline;
  },

  updateAssignment: async (fingerprint: string, assignedTo: string | null) => {
    logger.info("Updating issue assignment", { fingerprint, assignedTo });
    const group = await GroupRepository.findByFingerprint(fingerprint);
    if (!group) {
      return null;
    }

    const result = await GroupRepository.updateAssignment(fingerprint, assignedTo);
    return result[0] ? { ...group, ...result[0] } : null;
  },

  getReleases: async (fingerprint: string) => {
    logger.debug("Fetching release distribution for group", { fingerprint });
    return await GroupRepository.getReleaseDistribution(fingerprint);
  },
};

