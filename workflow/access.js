// Demonstration grants for the internal employee portal. Document access also
// requires membership of the source record's allowedUserIds.
export const workflowGrants = {
  reviewer: ['evga', 'prof', 'objections', 'sva', 'sur'],
  author: ['evga', 'objections', 'prof', 'sva'],
  director: ['evga', 'reports'],
  region: ['sur'],
  analyst: ['sur'],
  quality: ['sva', 'evga'],
  commission: ['objections'],
  secretary: ['objections'],
};
