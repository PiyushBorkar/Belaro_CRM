// Order outcome labels, following the old DCR sheet's Status column
// (In-Progress / Order Closed / Order Lost). Values match Project::getStatusAttribute.
// "Installed" sits between: everything installed, waiting for someone to close the order.
export const STATUS = {
  not_started: { label: 'New',          tone: 'neutral' },
  in_progress: { label: 'In-progress',  tone: 'warning' },
  installed:   { label: 'Installed',    tone: 'info' },
  closed:      { label: 'Order closed', tone: 'success' },
  lost:        { label: 'Order lost',   tone: 'danger' },
};
