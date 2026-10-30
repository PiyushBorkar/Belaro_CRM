import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/**
 * Every server read/write the UI does, as TanStack Query hooks.
 * Query keys live in `keys` so mutations can invalidate exactly what changed.
 */
export const keys = {
  projects:  (filters) => ['projects', 'list', filters ?? {}],
  project:   (id) => ['projects', 'detail', String(id)],
  tracking:  (id) => ['projects', 'tracking', String(id)],
  stats:     (range) => ['dashboard', 'stats', range ?? {}],
  activity:  (filters) => ['activity', filters ?? {}],
  notifications: ['notifications'],
  users:     ['users'],
  settings:  ['settings'],
  allProducts: ['products', 'all'],
  designers: ['lookups', 'designers'],
  products:  ['lookups', 'products'],
  supervisors: ['lookups', 'supervisors'],
};

// ─── Reads ────────────────────────────────────────────────────────────────────

export const useProjects = (filters) =>
  useQuery({
    queryKey: keys.projects(filters),
    queryFn: ({ signal }) => api.getProjects(filters, signal),
    placeholderData: keepPreviousData, // keep the old rows visible while filters change
  });

export const useProject = (id) =>
  useQuery({ queryKey: keys.project(id), queryFn: () => api.getProjectById(id).then((r) => r.data) });

export const useProjectTracking = (id) =>
  useQuery({ queryKey: keys.tracking(id), queryFn: () => api.getProjectTracking(id).then((r) => r.data ?? []) });

export const useDashboardStats = (range) =>
  useQuery({ queryKey: keys.stats(range), queryFn: () => api.getDashboardStats(range), placeholderData: keepPreviousData });

export const useActivity = (filters) =>
  useQuery({ queryKey: keys.activity(filters), queryFn: () => api.getActivity(filters), placeholderData: keepPreviousData });

export const useNotifications = () =>
  // Every 30s: new orders pop up for production (NotificationPopup) without a refresh
  useQuery({ queryKey: keys.notifications, queryFn: api.getNotifications, refetchInterval: 30_000 });

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: keys.users, queryFn: api.getUsers, enabled });

export const useSettings = (enabled = true) =>
  useQuery({ queryKey: keys.settings, queryFn: api.getSettings, enabled });

export const useAllProducts = () =>
  useQuery({ queryKey: keys.allProducts, queryFn: api.getAllProducts });

const LOOKUP = { staleTime: 5 * 60_000 };

export const useDesigners = (enabled = true) =>
  useQuery({ queryKey: keys.designers, queryFn: api.getDesigners, enabled, ...LOOKUP });

export const useProducts = (enabled = true) =>
  useQuery({ queryKey: keys.products, queryFn: api.getProducts, enabled, ...LOOKUP });

export const useSupervisors = (enabled = true) =>
  useQuery({ queryKey: keys.supervisors, queryFn: api.getSupervisors, enabled, ...LOOKUP });

// ─── Writes ───────────────────────────────────────────────────────────────────

// Anything that changes a project refreshes lists, its detail, its history, the dashboard and the activity log
function useProjectMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export const useCreateProject = () => useProjectMutation((data) => api.createProject(data));
export const useAssignProject = (id) => useProjectMutation((data) => api.assignProject(id, data));
export const useUpdateDesignerFields = (id) => useProjectMutation((data) => api.updateDesignerFields(id, data));
export const useUpdateProductionFields = (id) => useProjectMutation((data) => api.updateProductionFields(id, data));
export const useUpdateInstallations = (id) => useProjectMutation((data) => api.updateInstallations(id, data));
export const useDeleteProject = (id) => useProjectMutation(() => api.deleteProject(id));
export const useRestoreProject = (id) => useProjectMutation(() => api.restoreProject(id));
export const useMarkLost = (id) => useProjectMutation((reason) => api.markProjectLost(id, reason));
export const useReopenProject = (id) => useProjectMutation(() => api.reopenProject(id));
export const useCloseProject = (id) => useProjectMutation((closedOn) => api.closeProject(id, closedOn));
export const useReopenClosedProject = (id) => useProjectMutation(() => api.reopenClosedProject(id));

export const useErpLookup = () => useMutation({ mutationFn: (number) => api.lookupErpOrder(number) });

function useUserMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.users });
      qc.invalidateQueries({ queryKey: ['lookups'] });
    },
  });
}

export const useCreateUser = () => useUserMutation((data) => api.createUser(data));
export const useUpdateUser = () => useUserMutation(({ id, ...data }) => api.updateUser(id, data));
export const useDeactivateUser = () => useUserMutation((id) => api.deactivateUser(id));

export const useChangePassword = () => useMutation({ mutationFn: (data) => api.changePassword(data) });

function useNotificationMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }) });
}

export const useMarkNotificationRead = () => useNotificationMutation((id) => api.markNotificationRead(id));
export const useMarkAllNotificationsRead = () => useNotificationMutation(() => api.markAllNotificationsRead());

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.updateSettings(data),
    onSuccess: (res) => qc.setQueryData(keys.settings, res.data),
  });
}

export const useTestErp = () => useMutation({ mutationFn: (number) => api.testErp(number) });

function useProductMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.allProducts });
      qc.invalidateQueries({ queryKey: keys.products });
    },
  });
}

export const useCreateProduct = () => useProductMutation((data) => api.createProduct(data));
export const useUpdateProduct = () => useProductMutation(({ id, ...data }) => api.updateProduct(id, data));
