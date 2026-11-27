const versionTypeLabels = {
  release: 'Rilis',
  snapshot: 'Snapshot',
  old_beta: 'Beta lama',
  old_alpha: 'Alpha lama'
};

const versionFilters = {
  all: () => true,
  release: (version) => version.type === 'release',
  snapshot: (version) => version.type === 'snapshot',
  legacy: (version) => version.type === 'old_alpha' || version.type === 'old_beta'
};

function filterOfficialVersions(versions, filter) {
  return versions.filter(versionFilters[filter] || versionFilters.all);
}

function getVersionTypeLabel(type) {
  return versionTypeLabels[type] || type;
}

const versionFilterApi = { filterOfficialVersions, getVersionTypeLabel };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = versionFilterApi;
} else {
  window.vannotVersionFilter = versionFilterApi;
}
