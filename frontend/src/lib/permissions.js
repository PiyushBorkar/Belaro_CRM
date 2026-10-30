/**
 * What the current user may see or do in the UI.
 * Mirrors Backend/app/Policies and the gates in AppServiceProvider — the API is
 * the real gate, this only decides which buttons, sections and pages to show.
 * Keep them in sync.
 */

export const APP_ROLES = ['admin', 'manager', 'designer', 'production', 'supervisor'];

export const PERMISSIONS = {
  manageProducts: 'manage products',
  deleteProjects: 'delete projects',
  fixProduction:  'fix production entries',
};

export const hasRole = (user, ...roles) => (user?.roles ?? []).some((r) => roles.includes(r));
export const hasPermission = (user, permission) => (user?.permissions ?? []).includes(permission);

export const can = {
  useApp:          (user) => hasRole(user, ...APP_ROLES),
  createProject:   (user) => hasRole(user, 'manager', 'designer'),
  chooseDesigner:  (user) => hasRole(user, 'manager'),
  assignProject:   (user) => hasRole(user, 'manager'),
  manageUsers:     (user) => hasRole(user, 'admin', 'manager'),
  grantAdmin:      (user) => hasRole(user, 'admin'),
  seeTeamStats:    (user) => hasRole(user, 'admin', 'manager'),
  seeMoney:        (user) => hasRole(user, 'admin', 'manager', 'designer'),
  manageSettings:  (user) => hasRole(user, 'manager'),
  viewActivity:    (user) => hasRole(user, 'manager'),
  manageProducts:  (user) => hasPermission(user, PERMISSIONS.manageProducts),
  deleteProjects:  (user) => hasPermission(user, PERMISSIONS.deleteProjects),
  openSettings:    (user) => can.manageSettings(user) || can.manageProducts(user),

  // A designer named as site supervisor on someone else's project sees it read-only
  superviseOnly:   (user, project) => hasRole(user, 'designer') && !hasRole(user, 'manager') && project?.assigned_designer_id !== user.id,

  markLost:        (user, project) => hasRole(user, 'manager') || (hasRole(user, 'designer') && project?.assigned_designer_id === user.id),

  // A closed order is the manager's alone (ProjectPolicy::updateDesignerFields)
  editDesignerFields:   (user, project) => hasRole(user, 'manager')
    || (hasRole(user, 'designer') && project?.assigned_designer_id === user.id && !project?.closed_on),
  closeOrder:           (user, project) => hasRole(user, 'manager') || (hasRole(user, 'designer') && project?.assigned_designer_id === user.id),
  reopenClosedOrder:    (user) => hasRole(user, 'manager'),
  editProductionFields: (user, project) => hasRole(user, 'production') && !!project?.factory_production_login_date,
  bypassProductionLocks: (user) => hasPermission(user, PERMISSIONS.fixProduction),
};
