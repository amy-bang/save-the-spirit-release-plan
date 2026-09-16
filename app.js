(function () {
  'use strict';

  var DATA_VERSION = 17;
  var STORAGE_KEY = 'sts-milestone-calendar';
  var WEEK_KEY = 'sts-current-week-v3';
  var SUPABASE_URL = 'https://ewmzebxwswlwausrksks.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_p-0hxsOm6NQis2xy5BLv6w_Rxz2kDk6';
  var SHARED_PLAN_ID = 'main';
  var LEGACY_KEYS = ['sts-milestone-calendar-v16', 'sts-milestone-calendar-v15', 'sts-milestone-calendar-v14', 'sts-milestone-calendar-v13', 'sts-milestone-calendar-v12', 'sts-milestone-calendar-v11', 'sts-milestone-calendar-v10', 'sts-milestone-calendar-v9', 'sts-milestone-calendar-v8', 'sts-milestone-calendar-deleted-v7', 'sts-current-week-v2'];
  var STEAM_AREAS = ['등록·설정', '마케팅', '상점 페이지', '심사·대기', '출시'];
  var VALID_AREAS = ['캐릭터', '스테이지', '전투', '성장', '아웃게임', 'steam'];
  var BAR_TYPES = ['art-ta', 'vfx', 'pm', 'tech', 'ui'];
  var TEAM_LABELS = {
    'art-ta': 'Art / TA',
    'vfx': 'VFX',
    'pm': 'PM',
    'tech': 'Tech',
    'ui': 'UI'
  };
  var TYPE_BY_AREA = {
    '캐릭터': 'art-ta',
    '스테이지': 'art-ta',
    '전투': 'vfx',
    '성장': 'tech',
    '아웃게임': 'tech',
    'steam': 'pm',
    '등록·설정': 'pm',
    '마케팅': 'pm',
    '상점 페이지': 'pm',
    '심사·대기': 'pm',
    '출시': 'pm'
  };
  var DATE_LABELS = [
    '2026.09.07', '2026.09.14', '2026.09.21', '2026.09.28',
    '2026.10.05', '2026.10.12', '2026.10.19', '2026.10.26',
    '2026.11.02', '2026.11.09', '2026.11.16', '2026.11.23', '2026.11.30',
    '2026.12.07', '2026.12.14', '2026.12.21', '2026.12.28',
    '2027.01.04', '2027.01.11', '2027.01.18', '2027.01.25'
  ];

  var root = document.body;
  var main = document.querySelector('main');
  var board = document.querySelector('.board');
  var editButton = document.getElementById('editMode');
  var addButton = document.getElementById('addTask');
  var addBarButton = document.getElementById('addBar');
  var deleteBarButton = document.getElementById('deleteBar');
  var saveButton = document.getElementById('savePlan');
  saveButton.textContent = '공용 저장';
  saveButton.title = '모든 사용자에게 보이는 일정으로 저장합니다';
  var resetButton = document.getElementById('resetPlan');
  var syncStatus = document.getElementById('syncStatus');
  var editorIdentity = document.getElementById('editorIdentity');
  var loginEditorButton = document.getElementById('loginEditor');
  var logoutEditorButton = document.getElementById('logoutEditor');
  var manageEditorsButton = document.getElementById('manageEditors');
  var authModal = document.getElementById('authModal');
  var authForm = document.getElementById('authForm');
  var authEmailInput = document.getElementById('authEmail');
  var authFeedback = document.getElementById('authFeedback');
  var sendMagicLinkButton = document.getElementById('sendMagicLink');
  var cancelAuthButton = document.getElementById('cancelAuth');
  var memberModal = document.getElementById('memberModal');
  var memberForm = document.getElementById('memberForm');
  var memberEmailInput = document.getElementById('memberEmail');
  var memberList = document.getElementById('memberList');
  var closeMembersButton = document.getElementById('closeMembers');
  var weekSelect = document.getElementById('currentWeek');
  var modal = document.getElementById('taskModal');
  var form = document.getElementById('taskForm');
  var cancelButton = document.getElementById('cancelTask');
  var barModal = document.getElementById('barModal');
  var barForm = document.getElementById('barForm');
  var cancelBarButton = document.getElementById('cancelBar');
  var barTaskSelect = document.getElementById('barTask');
  var barLabelInput = document.getElementById('barLabel');
  var barStartSelect = document.getElementById('barStart');
  var barEndSelect = document.getElementById('barEnd');
  var barTeamHint = document.getElementById('barTeamHint');
  var teamFilter = document.querySelector('.team-filter');
  if (teamFilter && !teamFilter.querySelector('[data-team="ui"]')) {
    var uiFilterButton = document.createElement('button');
    var uiFilterDot = document.createElement('i');
    uiFilterButton.className = 'filter-chip';
    uiFilterButton.type = 'button';
    uiFilterButton.dataset.team = 'ui';
    uiFilterButton.setAttribute('aria-pressed', 'false');
    uiFilterDot.className = 'dot';
    uiFilterDot.style.background = '#f472b6';
    uiFilterButton.appendChild(uiFilterDot);
    uiFilterButton.appendChild(document.createTextNode('UI'));
    teamFilter.appendChild(uiFilterButton);
  }
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.filter-chip[data-team]'));
  var filterStatus = document.getElementById('filterStatus');
  var phases = Array.prototype.slice.call(board.querySelectorAll('.phase'));
  var editOn = false;
  var activeDrag = null;
  var dirty = false;
  var lastFocused = null;
  var toastTimer = null;
  var selectedBar = null;
  var activeTeams = new Set();
  var filterEmpty = null;
  var sharedClient = null;
  var sharedChannel = null;
  var sharedRevision = 0;
  var sharedReady = false;
  var currentSession = null;
  var editorRole = null;
  var saveInProgress = false;
  var saveQueued = false;
  var pendingRemoteRecord = null;
  var localChangeCounter = 0;
  var lastWriteId = '';
  var authSubscription = null;

  function allRows() {
    return Array.prototype.slice.call(board.querySelectorAll('.row'));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readRange(bar) {
    var match = String(bar.style.gridColumn || '').match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return { start: 4, end: 5 };
    return { start: Number(match[1]), end: Number(match[2]) };
  }

  function ownerHasUi(owner) {
    return /(^|[\s/·])ui($|[\s/·])/i.test(String(owner || ''));
  }

  function typeForRole(area, owner) {
    if (area === 'steam' || STEAM_AREAS.indexOf(area) !== -1) return 'pm';
    var role = String(owner || '').toLowerCase();
    if (role.indexOf('vfx') !== -1) return 'vfx';
    if (ownerHasUi(role)) return 'ui';
    if (role.indexOf('tech') !== -1) return 'tech';
    if (role.indexOf('art') !== -1 || role.indexOf('ta') !== -1) return 'art-ta';
    if (role.indexOf('pm') !== -1 || role.indexOf('기획') !== -1 || role.indexOf('marketing') !== -1 || role.indexOf('admin') !== -1) return 'pm';
    return TYPE_BY_AREA[area] || 'pm';
  }

  function barType(bar) {
    for (var i = 0; i < BAR_TYPES.length; i += 1) {
      if (bar.classList.contains(BAR_TYPES[i])) return BAR_TYPES[i];
    }
    var row = bar.closest('.row');
    var area = row ? row.dataset.area : '아웃게임';
    var owner = row && row.querySelector('.owner') ? row.querySelector('.owner').textContent : '';
    return typeForRole(area, owner);
  }

  function syncUiBarTypes(row) {
    if (!row) return;
    var area = row.dataset.area || '아웃게임';
    var owner = row.querySelector('.owner') ? row.querySelector('.owner').textContent : '';
    var steam = area === 'steam' || STEAM_AREAS.indexOf(area) !== -1;
    var wantsUi = !steam && ownerHasUi(owner);
    Array.prototype.slice.call(row.querySelectorAll('.bar')).forEach(function (bar) {
      if (!wantsUi && !bar.classList.contains('ui')) return;
      BAR_TYPES.forEach(function (type) { bar.classList.remove(type); });
      bar.classList.add(wantsUi ? 'ui' : typeForRole(area, owner));
    });
  }

  function cleanTaskHtml(html) {
    var source = document.createElement('template');
    var output = document.createElement('div');
    source.innerHTML = String(html || '');

    function copyNode(node, target) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.textContent || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        target.appendChild(document.createElement('br'));
        return;
      }
      var nextTarget = target;
      if (tag === 'small') {
        nextTarget = document.createElement('small');
        target.appendChild(nextTarget);
      }
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        copyNode(child, nextTarget);
      });
    }

    Array.prototype.slice.call(source.content.childNodes).forEach(function (node) {
      copyNode(node, output);
    });
    return output.innerHTML;
  }

  function makeStableKey(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function prepareStructure() {
    var section = 'ingame';
    Array.prototype.slice.call(board.children).forEach(function (node) {
      if (node === phases[0]) section = 'ingame';
      if (node === phases[1]) section = '아웃게임';
      if (node === phases[2]) section = 'steam';
      if (!node.classList || !node.classList.contains('row')) return;
      var originalId = (node.querySelector('.id') || {}).textContent || makeStableKey('base');
      originalId = originalId.trim();
      node.dataset.originalId = originalId;
      node.dataset.key = 'base-' + originalId;
      node.dataset.area = section;
    });

    function rowByOriginalId(id) {
      return allRows().find(function (row) {
        return row.dataset.originalId === id;
      });
    }

    function addSubphase(label, ids, beforeNode) {
      var target = beforeNode === undefined ? phases[1] : beforeNode;
      var heading = document.createElement('div');
      heading.className = 'grid subphase';
      heading.dataset.area = label;
      heading.innerHTML = '<div class="sub-name">' + label + '</div><div class="sub-line"></div>';
      board.insertBefore(heading, target);
      ids.map(rowByOriginalId).filter(Boolean).forEach(function (row) {
        row.dataset.area = label;
        board.insertBefore(row, target);
      });
    }

    addSubphase('캐릭터', ['02', 'D4']);
    addSubphase('스테이지', ['01', '03']);
    addSubphase('전투', ['04', '05', 'D1', 'D2', '09', '10', '13']);
    addSubphase('성장', ['14']);
  }

  function insertByArea(row, area) {
    var groupedAreas = VALID_AREAS.slice(0, 4).concat(STEAM_AREAS);
    if (groupedAreas.indexOf(area) !== -1) {
      var heading = Array.prototype.slice.call(board.querySelectorAll('.subphase')).find(function (item) {
        return item.dataset.area === area;
      });
      if (!heading) {
        board.appendChild(row);
        return;
      }
      var boundary = heading.nextElementSibling;
      while (boundary && !boundary.classList.contains('subphase') && !boundary.classList.contains('phase')) {
        boundary = boundary.nextElementSibling;
      }
      board.insertBefore(row, boundary);
      return;
    }
    if (area === '아웃게임') {
      board.insertBefore(row, phases[2]);
      return;
    }
    if (area === 'steam') {
      board.appendChild(row);
      return;
    }
    board.appendChild(row);
  }

  function rowModel(row) {
    return {
      key: row.dataset.key || makeStableKey('task'),
      area: VALID_AREAS.indexOf(row.dataset.area) !== -1 ? row.dataset.area : '아웃게임',
      taskHtml: cleanTaskHtml(row.querySelector('.task') ? row.querySelector('.task').innerHTML : ''),
      owner: row.querySelector('.owner') ? row.querySelector('.owner').textContent.trim() : '전원',
      bars: Array.prototype.slice.call(row.querySelectorAll('.bar')).map(function (bar) {
        var range = readRange(bar);
        return {
          key: bar.dataset.key || makeStableKey('bar'),
          text: bar.textContent.trim(),
          start: clamp(range.start, 4, 24),
          end: clamp(range.end, range.start + 1, 25),
          type: barType(bar)
        };
      })
    };
  }

  function normalizeModel(model) {
    var area = VALID_AREAS.indexOf(model && model.area) !== -1 ? model.area : '아웃게임';
    var bars = Array.isArray(model && model.bars) ? model.bars : [];
    var owner = String(model && model.owner || '전원').slice(0, 120);
    var rowKey = typeof model.key === 'string' && model.key ? model.key : makeStableKey('task');
    return {
      key: rowKey,
      area: area,
      taskHtml: cleanTaskHtml(model && model.taskHtml),
      owner: owner,
      bars: bars.map(function (bar, index) {
        var start = clamp(Number(bar.start) || 4, 4, 24);
        var end = clamp(Number(bar.end) || start + 1, start + 1, 25);
        return {
          key: typeof bar.key === 'string' && bar.key ? bar.key : rowKey + '-bar-' + index,
          text: String(bar.text || '').slice(0, 160),
          start: start,
          end: end,
          type: area === 'steam' || STEAM_AREAS.indexOf(area) !== -1
            ? 'pm'
            : (BAR_TYPES.indexOf(bar.type) !== -1 ? bar.type : typeForRole(area, owner))
        };
      })
    };
  }

  function createRow(model) {
    var safe = normalizeModel(model);
    var row = document.createElement('div');
    row.className = 'grid row';
    row.dataset.key = safe.key;
    row.dataset.area = safe.area;
    row.innerHTML = '<div class="id"></div><div class="task"></div><div class="owner"></div><div class="cells" aria-hidden="true"></div>';
    row.querySelector('.task').innerHTML = safe.taskHtml;
    row.querySelector('.owner').textContent = safe.owner;
    safe.bars.forEach(function (item) {
      var bar = document.createElement('div');
      bar.className = 'bar ' + item.type;
      bar.dataset.key = item.key;
      bar.textContent = item.text;
      bar.style.gridColumn = item.start + ' / ' + item.end;
      row.appendChild(bar);
    });
    return row;
  }

  function currentPayload() {
    return {
      version: DATA_VERSION,
      savedAt: new Date().toISOString(),
      rows: allRows().map(rowModel)
    };
  }

  function cacheDraft(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {}
  }

  function renderRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return false;
    if (activeDrag) cleanupDrag(activeDrag.bar);
    selectBar(null);
    setEditMode(false);
    allRows().forEach(function (row) { row.remove(); });
    rows.forEach(function (model) {
      var safe = normalizeModel(model);
      var row = createRow(safe);
      insertByArea(row, safe.area);
      wireRow(row);
    });
    renumber();
    populateBarTaskOptions();
    markWeek();
    applyTeamFilter();
    return true;
  }

  function setSyncState(message, state) {
    if (!syncStatus) return;
    syncStatus.textContent = message;
    syncStatus.dataset.state = state || 'connecting';
  }

  function hasEditorAccess() {
    return editorRole === 'owner' || editorRole === 'editor';
  }

  function refreshPermissionUi() {
    var canEdit = sharedReady && hasEditorAccess();
    editButton.disabled = !canEdit;
    addButton.disabled = !canEdit;
    addBarButton.disabled = !canEdit;
    saveButton.disabled = !canEdit || saveInProgress || !dirty;
    resetButton.disabled = !sharedReady || saveInProgress;
    if (!canEdit && editOn) setEditMode(false);
    loginEditorButton.hidden = Boolean(currentSession);
    logoutEditorButton.hidden = !currentSession;
    manageEditorsButton.hidden = editorRole !== 'owner';
    editorIdentity.hidden = !currentSession;
    editorIdentity.textContent = currentSession
      ? (currentSession.user.email || '로그인됨') + (hasEditorAccess() ? ' · 편집 가능' : ' · 보기 전용')
      : '';
  }

  function applySharedRecord(record, message) {
    if (!record || !record.payload || !Array.isArray(record.payload.rows)) return false;
    if (!renderRows(record.payload.rows)) return false;
    sharedRevision = Number(record.revision) || 0;
    sharedReady = true;
    pendingRemoteRecord = null;
    dirty = false;
    saveButton.classList.remove('has-changes');
    saveButton.textContent = '공용 저장';
    cacheDraft(record.payload);
    setSyncState(message || '공용 일정 최신 상태', 'online');
    refreshPermissionUi();
    return true;
  }

  function readStoredPlan() {
    var keys = [STORAGE_KEY].concat(LEGACY_KEYS);
    try {
      for (var i = 0; i < keys.length; i += 1) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        try {
          var payload = JSON.parse(raw);
          if (payload && Array.isArray(payload.rows)) {
            return { key: keys[i], payload: payload };
          }
        } catch (parseError) {}
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function migrateSavedRows(payload, defaultRows) {
    var fromVersion = Number(payload && payload.version) || 0;
    var defaultsByKey = {};
    defaultRows.forEach(function (model) { defaultsByKey[model.key] = model; });
    var rows = payload.rows.map(normalizeModel);

    function replaceIfPresent(key) {
      if (!defaultsByKey[key]) return;
      var index = rows.findIndex(function (model) { return model.key === key; });
      if (index !== -1) rows[index] = defaultsByKey[key];
    }

    if (fromVersion < 15) {
      ['base-D1', 'base-D2', 'base-D3'].forEach(replaceIfPresent);
      var hasD4 = rows.some(function (model) { return model.key === 'base-D4'; });
      if (!hasD4 && defaultsByKey['base-D4']) rows.push(defaultsByKey['base-D4']);
    }
    if (fromVersion < 16) replaceIfPresent('base-20');
    return rows;
  }

  function restoreSavedPlan() {
    var stored = readStoredPlan();
    if (!stored) return false;
    try {
      var defaultRows = allRows().map(rowModel);
      var rows = migrateSavedRows(stored.payload, defaultRows);
      allRows().forEach(function (row) { row.remove(); });
      rows.forEach(function (model) {
        var safe = normalizeModel(model);
        insertByArea(createRow(safe), safe.area);
      });
      if (stored.key !== STORAGE_KEY || Number(stored.payload.version) !== DATA_VERSION) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: DATA_VERSION,
          savedAt: stored.payload.savedAt || new Date().toISOString(),
          migratedAt: new Date().toISOString(),
          rows: allRows().map(rowModel)
        }));
        announce('기존 브라우저 저장 내용을 복구했습니다.');
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function renumber() {
    allRows().forEach(function (row, index) {
      var id = row.querySelector('.id');
      if (id) id.textContent = String(index + 1).padStart(2, '0');
    });
  }

  function announce(message) {
    var toast = document.getElementById('statusToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2100);
  }

  function markDirty() {
    localChangeCounter += 1;
    dirty = true;
    if (saveInProgress) saveQueued = true;
    saveButton.classList.add('has-changes');
    saveButton.textContent = '변경사항 공용 저장';
    refreshPermissionUi();
  }

  function makeWriteId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (character) {
      var random = Math.random() * 16 | 0;
      var value = character === 'x' ? random : (random & 3 | 8);
      return value.toString(16);
    });
  }

  async function persist(message) {
    if (!sharedReady || !sharedClient) {
      announce('공용 일정 연결이 끝난 뒤 다시 저장해 주세요.');
      return false;
    }
    if (!hasEditorAccess()) {
      openAuthModal();
      announce('편집자 로그인 후 저장할 수 있습니다.');
      return false;
    }
    if (!dirty) {
      announce('저장할 변경사항이 없습니다.');
      return true;
    }
    if (saveInProgress) {
      saveQueued = true;
      return false;
    }

    saveInProgress = true;
    saveQueued = false;
    refreshPermissionUi();
    setSyncState('공용 일정 저장 중', 'saving');
    var payload = currentPayload();
    var changeCounterAtStart = localChangeCounter;
    var baseRevision = sharedRevision;
    var writeId = makeWriteId();
    lastWriteId = writeId;
    cacheDraft(payload);

    try {
      var result = await sharedClient
        .from('gantt_plans')
        .update({ payload: payload, write_id: writeId })
        .eq('id', SHARED_PLAN_ID)
        .eq('revision', baseRevision)
        .select('payload, revision, updated_at, updated_by, write_id')
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        var latest = await sharedClient
          .from('gantt_plans')
          .select('payload, revision, updated_at, updated_by, write_id')
          .eq('id', SHARED_PLAN_ID)
          .maybeSingle();
        if (latest.data) pendingRemoteRecord = latest.data;
        setSyncState('다른 편집자의 저장본이 있습니다', 'warning');
        announce('다른 편집자가 먼저 저장했습니다. 최신본을 다시 불러온 뒤 변경해 주세요.');
        return false;
      }
      sharedRevision = Number(result.data.revision) || baseRevision + 1;
      cacheDraft(result.data.payload || payload);
      if (localChangeCounter === changeCounterAtStart) {
        dirty = false;
        saveButton.classList.remove('has-changes');
        saveButton.textContent = '공용 저장';
      } else {
        saveQueued = true;
      }
      setSyncState('공용 일정 최신 상태', 'online');
      announce(message || '공용 일정에 저장했습니다.');
      return true;
    } catch (error) {
      setSyncState('저장 실패 · 변경사항은 이 화면에 보관됨', 'error');
      announce('공용 저장에 실패했습니다. 연결을 확인하고 다시 시도해 주세요.');
      return false;
    } finally {
      saveInProgress = false;
      refreshPermissionUi();
      if (saveQueued && dirty && sharedRevision !== baseRevision) {
        saveQueued = false;
        window.setTimeout(function () {
          persist('이어진 변경사항까지 공용 일정에 저장했습니다.');
        }, 0);
      }
    }
  }

  function openAuthModal() {
    lastFocused = document.activeElement;
    authFeedback.textContent = '편집 권한이 등록된 이메일을 입력해 주세요.';
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    if ('inert' in main) main.inert = true;
    window.setTimeout(function () { authEmailInput.focus(); }, 0);
  }

  function closeAuthModal() {
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
    if ('inert' in main) main.inert = false;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function closeMemberModal() {
    memberModal.classList.remove('open');
    memberModal.setAttribute('aria-hidden', 'true');
    if ('inert' in main) main.inert = false;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  async function refreshSessionAccess(session) {
    currentSession = session || null;
    editorRole = null;
    if (currentSession && currentSession.user && currentSession.user.email) {
      var email = currentSession.user.email.trim().toLowerCase();
      var result = await sharedClient
        .from('gantt_editors')
        .select('role')
        .eq('email', email)
        .maybeSingle();
      if (!result.error && result.data) editorRole = result.data.role;
    }
    refreshPermissionUi();
  }

  async function loadSharedPlan(options) {
    if (!sharedClient) return false;
    var force = Boolean(options && options.force);
    setSyncState('공용 일정 불러오는 중', 'connecting');
    try {
      var result = await sharedClient
        .from('gantt_plans')
        .select('payload, revision, updated_at, updated_by, write_id')
        .eq('id', SHARED_PLAN_ID)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setSyncState('공용 일정 초기 설정이 필요합니다', 'warning');
        return false;
      }
      if (!force && sharedReady && (dirty || saveInProgress)) {
        pendingRemoteRecord = result.data;
        setSyncState('새 저장본 있음 · 최신본 다시 불러오기', 'warning');
        return false;
      }
      return applySharedRecord(result.data, '공용 일정 최신 상태');
    } catch (error) {
      setSyncState('공용 일정에 연결하지 못했습니다', 'error');
      return false;
    }
  }

  function subscribeSharedPlan() {
    if (!sharedClient) return;
    if (sharedChannel) sharedClient.removeChannel(sharedChannel);
    sharedChannel = sharedClient
      .channel('gantt-plan-main')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'gantt_plans',
        filter: 'id=eq.' + SHARED_PLAN_ID
      }, function (change) {
        var record = change.new;
        if (!record || !record.payload) return;
        if (record.write_id && record.write_id === lastWriteId) {
          sharedRevision = Number(record.revision) || sharedRevision;
          setSyncState('공용 일정 최신 상태', 'online');
          return;
        }
        if (dirty || saveInProgress) {
          pendingRemoteRecord = record;
          setSyncState('다른 편집자의 새 저장본 있음', 'warning');
          announce('다른 편집자가 저장했습니다. 내 변경을 확인한 뒤 최신본을 불러와 주세요.');
          return;
        }
        applySharedRecord(record, '다른 편집자의 변경을 반영했습니다');
        announce('다른 편집자의 변경을 반영했습니다.');
      })
      .subscribe(function (status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncState('실시간 연결 재시도 중', 'warning');
        }
      });
  }

  async function loadEditors() {
    if (!sharedClient || editorRole !== 'owner') return;
    memberList.innerHTML = '<li class="member-empty">편집자 목록을 불러오는 중입니다.</li>';
    var result = await sharedClient
      .from('gantt_editors')
      .select('email, role')
      .order('role', { ascending: true })
      .order('email', { ascending: true });
    memberList.innerHTML = '';
    if (result.error) {
      memberList.innerHTML = '<li class="member-empty">목록을 불러오지 못했습니다.</li>';
      return;
    }
    (result.data || []).forEach(function (member) {
      var item = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = member.email + (member.role === 'owner' ? ' · 관리자' : '');
      item.appendChild(label);
      if (member.role !== 'owner') {
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'danger-action';
        remove.textContent = '삭제';
        remove.addEventListener('click', async function () {
          if (!window.confirm(member.email + '의 편집 권한을 삭제할까요?')) return;
          var deletion = await sharedClient.from('gantt_editors').delete().eq('email', member.email).eq('role', 'editor');
          if (deletion.error) announce('편집자 권한을 삭제하지 못했습니다.');
          else {
            announce('편집자 권한을 삭제했습니다.');
            loadEditors();
          }
        });
        item.appendChild(remove);
      }
      memberList.appendChild(item);
    });
  }

  async function initializeSharedApp() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setSyncState('공용 저장 기능을 불러오지 못했습니다', 'error');
      return;
    }
    sharedClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
    });
    var initial = await sharedClient.auth.getSession();
    await refreshSessionAccess(initial.data && initial.data.session);
    var listener = sharedClient.auth.onAuthStateChange(function (event, session) {
      window.setTimeout(async function () {
        await refreshSessionAccess(session);
        if (event === 'SIGNED_IN') {
          closeAuthModal();
          announce(hasEditorAccess() ? '편집자로 로그인했습니다.' : '로그인했지만 편집 권한은 없습니다.');
        }
      }, 0);
    });
    authSubscription = listener.data && listener.data.subscription;
    subscribeSharedPlan();
    await loadSharedPlan({ force: true });
  }

  function taskNameForRow(row) {
    var task = row && row.querySelector('.task');
    var first = task && task.childNodes[0];
    var name = first ? first.textContent.trim() : '';
    return name || (task ? task.textContent.trim() : '작업 항목');
  }

  function teamsForRow(row) {
    var result = new Set();
    var owner = row && row.querySelector('.owner') ? row.querySelector('.owner').textContent.toLowerCase() : '';
    if (owner.indexOf('전원') !== -1 || owner.indexOf('all') !== -1) {
      BAR_TYPES.forEach(function (team) { result.add(team); });
      return result;
    }
    if (owner.indexOf('vfx') !== -1) result.add('vfx');
    if (owner.indexOf('tech') !== -1) result.add('tech');
    if (ownerHasUi(owner)) result.add('ui');
    if (owner.indexOf('art') !== -1 || /(^|[\s/·])ta($|[\s/·])/.test(owner)) result.add('art-ta');
    if (owner.indexOf('pm') !== -1 || owner.indexOf('기획') !== -1 || owner.indexOf('marketing') !== -1 || owner.indexOf('admin') !== -1) result.add('pm');
    if (!result.size) {
      Array.prototype.slice.call(row.querySelectorAll('.bar')).forEach(function (bar) {
        result.add(barType(bar));
      });
    }
    return result;
  }

  function selectBar(bar) {
    if (selectedBar && selectedBar !== bar) {
      selectedBar.classList.remove('bar-selected');
      selectedBar.setAttribute('aria-selected', 'false');
    }
    selectedBar = bar && document.documentElement.contains(bar) && editOn ? bar : null;
    if (selectedBar) {
      selectedBar.classList.add('bar-selected');
      selectedBar.setAttribute('aria-selected', 'true');
    }
    deleteBarButton.disabled = !selectedBar;
  }

  function applyTeamFilter() {
    if (activeDrag) cleanupDrag(activeDrag.bar);
    var rows = allRows();
    var visibleCount = 0;
    rows.forEach(function (row) {
      var teams = teamsForRow(row);
      var visible = activeTeams.size === 0 || Array.from(activeTeams).some(function (team) { return teams.has(team); });
      row.classList.toggle('is-filtered-out', !visible);
      row.setAttribute('aria-hidden', String(!visible));
      if (visible) visibleCount += 1;
    });

    Array.prototype.slice.call(board.querySelectorAll('.subphase')).forEach(function (heading) {
      var cursor = heading.nextElementSibling;
      var hasVisibleRow = false;
      while (cursor && !cursor.classList.contains('subphase') && !cursor.classList.contains('phase')) {
        if (cursor.classList.contains('row') && !cursor.classList.contains('is-filtered-out')) hasVisibleRow = true;
        cursor = cursor.nextElementSibling;
      }
      heading.classList.toggle('is-filtered-out', !hasVisibleRow);
      heading.setAttribute('aria-hidden', String(!hasVisibleRow));
    });

    phases.forEach(function (phase) {
      var cursor = phase.nextElementSibling;
      var hasVisibleRow = false;
      while (cursor && !cursor.classList.contains('phase')) {
        if (cursor.classList.contains('row') && !cursor.classList.contains('is-filtered-out')) hasVisibleRow = true;
        cursor = cursor.nextElementSibling;
      }
      phase.classList.toggle('is-filtered-out', !hasVisibleRow);
      phase.setAttribute('aria-hidden', String(!hasVisibleRow));
    });

    if (selectedBar && selectedBar.closest('.row').classList.contains('is-filtered-out')) selectBar(null);

    filterButtons.forEach(function (button) {
      var team = button.dataset.team;
      var active = team === 'all' ? activeTeams.size === 0 : activeTeams.has(team);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    if (filterEmpty) filterEmpty.classList.toggle('is-visible', visibleCount === 0);
    var selectedLabels = Array.from(activeTeams).map(function (team) { return TEAM_LABELS[team]; });
    filterStatus.textContent = (selectedLabels.length ? selectedLabels.join(' + ') : '전체') + ' · ' + visibleCount + '/' + rows.length + '개 작업';
  }

  function setBarAria(bar) {
    var range = readRange(bar);
    var startIndex = clamp(range.start - 4, 0, 20);
    var endIndex = clamp(range.end - 5, startIndex, 20);
    var row = bar.closest('.row');
    var taskName = taskNameForRow(row);
    var label = bar.textContent.trim();
    bar.classList.toggle('bar-compact', range.end - range.start === 1);
    bar.title = label;
    bar.setAttribute(
      'aria-label',
      taskName + '의 ' + label + ', ' + TEAM_LABELS[barType(bar)] + ', ' + DATE_LABELS[startIndex] + '부터 ' + DATE_LABELS[endIndex] + ' 시작 구간까지'
    );
  }

  function cleanupDrag(bar) {
    if (!bar) return;
    bar.classList.remove('selected-bar', 'resize-left', 'resize-right', 'resize-move');
    delete bar.dataset.edge;
    activeDrag = null;
  }

  function rangesOverlap(row, start, end, ignoredBar) {
    return Array.prototype.slice.call(row.querySelectorAll('.bar')).some(function (candidate) {
      if (candidate === ignoredBar) return false;
      var range = readRange(candidate);
      return start < range.end && end > range.start;
    });
  }

  function applyKeyboardRange(bar, event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
    var delta = event.key === 'ArrowLeft' ? -1 : 1;
    var range = readRange(bar);
    var start = range.start;
    var end = range.end;
    if (event.altKey) {
      start = clamp(start + delta, 4, end - 1);
    } else if (event.shiftKey) {
      end = clamp(end + delta, start + 1, 25);
    } else {
      var duration = end - start;
      start = clamp(start + delta, 4, 25 - duration);
      end = start + duration;
    }
    event.preventDefault();
    if (rangesOverlap(bar.closest('.row'), start, end, bar)) {
      announce('같은 작업의 다른 막대와 기간이 겹칩니다.');
      return true;
    }
    bar.style.gridColumn = start + ' / ' + end;
    setBarAria(bar);
    markDirty();
    announce(DATE_LABELS[start - 4] + ' — ' + DATE_LABELS[end - 5]);
    return true;
  }

  function beginTextEdit(element) {
    if (!editOn) return;
    element.dataset.beforeEdit = element.innerHTML;
    element.contentEditable = 'true';
    element.focus();
    var range = document.createRange();
    range.selectNodeContents(element);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function updateRowAria(row) {
    var task = row.querySelector('.task');
    var owner = row.querySelector('.owner');
    var taskText = task ? task.childNodes[0] && task.childNodes[0].textContent.trim() : '';
    if (!taskText && task) taskText = task.textContent.trim();
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', taskText + ', 담당 ' + (owner ? owner.textContent.trim() : '미정'));
    Array.prototype.slice.call(row.querySelectorAll('.bar')).forEach(setBarAria);
  }

  function wireBar(row, bar) {
    if (bar.dataset.wired === 'true') return;
    bar.dataset.wired = 'true';
    if (!bar.dataset.key) {
      var index = Array.prototype.slice.call(row.querySelectorAll('.bar')).indexOf(bar);
      bar.dataset.key = (row.dataset.key || makeStableKey('task')) + '-bar-' + index;
    }
    bar.contentEditable = 'false';
    setBarAria(bar);

    bar.addEventListener('focus', function () {
      if (editOn) selectBar(bar);
    });

    bar.addEventListener('dblclick', function (event) {
      if (!editOn) return;
      event.preventDefault();
      selectBar(bar);
      beginTextEdit(bar);
    });

    bar.addEventListener('input', function () {
      markDirty();
      setBarAria(bar);
    });

    bar.addEventListener('blur', function () {
      bar.contentEditable = 'false';
      delete bar.dataset.beforeEdit;
      setBarAria(bar);
    });

    bar.addEventListener('keydown', function (event) {
      if (!editOn) return;
      if (bar.contentEditable === 'true') {
        if (event.key === 'Escape') {
          event.preventDefault();
          bar.innerHTML = bar.dataset.beforeEdit || bar.innerHTML;
          bar.blur();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          bar.blur();
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        selectBar(bar);
        deleteSelectedBar();
        return;
      }
      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault();
        beginTextEdit(bar);
        return;
      }
      applyKeyboardRange(bar, event);
    });

    bar.addEventListener('pointermove', function (event) {
      if (!editOn || bar.contentEditable === 'true') return;
      if (!activeDrag) {
        var bounds = bar.getBoundingClientRect();
        var edge = 12;
        if (event.clientX - bounds.left < edge) bar.dataset.edge = 'left';
        else if (bounds.right - event.clientX < edge) bar.dataset.edge = 'right';
        else delete bar.dataset.edge;
        return;
      }
      if (activeDrag.bar !== bar) return;
      var cells = row.querySelector('.cells');
      var cellBounds = cells.getBoundingClientRect();
      var step = cellBounds.width / 21;
      var delta = Math.round((event.clientX - activeDrag.startX) / step);
      var start = activeDrag.oldStart;
      var end = activeDrag.oldEnd;
      if (activeDrag.mode === 'move') {
        var duration = end - start;
        start = clamp(start + delta, 4, 25 - duration);
        end = start + duration;
      } else if (activeDrag.mode === 'left') {
        start = clamp(start + delta, 4, end - 1);
      } else {
        end = clamp(end + delta, start + 1, 25);
      }
      bar.style.gridColumn = start + ' / ' + end;
      setBarAria(bar);
    });

    bar.addEventListener('pointerleave', function () {
      if (!activeDrag) delete bar.dataset.edge;
    });

    bar.addEventListener('pointerdown', function (event) {
      if (!editOn || bar.contentEditable === 'true' || event.button !== 0) return;
      event.preventDefault();
      selectBar(bar);
      try { bar.focus({ preventScroll: true }); } catch (error) { bar.focus(); }
      var bounds = bar.getBoundingClientRect();
      var range = readRange(bar);
      var mode = event.clientX - bounds.left < 12
        ? 'left'
        : bounds.right - event.clientX < 12
          ? 'right'
          : 'move';
      activeDrag = {
        bar: bar,
        startX: event.clientX,
        oldStart: range.start,
        oldEnd: range.end,
        mode: mode
      };
      bar.classList.add('selected-bar', 'resize-' + mode);
      bar.setPointerCapture(event.pointerId);
    });

    function finishPointerEdit() {
      if (!activeDrag || activeDrag.bar !== bar) return;
      var range = readRange(bar);
      var changed = range.start !== activeDrag.oldStart || range.end !== activeDrag.oldEnd;
      if (changed && rangesOverlap(row, range.start, range.end, bar)) {
        bar.style.gridColumn = activeDrag.oldStart + ' / ' + activeDrag.oldEnd;
        setBarAria(bar);
        announce('같은 작업의 다른 막대와 기간이 겹쳐 원래 일정으로 되돌렸습니다.');
      } else if (changed) {
        markDirty();
      }
      cleanupDrag(bar);
    }

    bar.addEventListener('pointerup', finishPointerEdit);
    bar.addEventListener('pointercancel', finishPointerEdit);
    bar.addEventListener('lostpointercapture', finishPointerEdit);
  }

  function deleteSelectedBar() {
    if (!selectedBar || !document.documentElement.contains(selectedBar)) {
      selectBar(null);
      announce('삭제할 막대를 먼저 선택해 주세요.');
      return false;
    }
    var bar = selectedBar;
    var row = bar.closest('.row');
    var label = bar.textContent.trim();
    var range = readRange(bar);
    var startLabel = DATE_LABELS[clamp(range.start - 4, 0, 20)];
    var endLabel = DATE_LABELS[clamp(range.end - 5, 0, 20)];
    if (!window.confirm('“' + taskNameForRow(row) + '”의 “' + label + '” 막대\n' + startLabel + ' — ' + endLabel + '\n\n이 막대를 삭제할까요?')) return false;
    var bars = Array.prototype.slice.call(row.querySelectorAll('.bar'));
    var index = bars.indexOf(bar);
    var nextFocus = bars[index + 1] || bars[index - 1] || null;
    selectBar(null);
    bar.remove();
    updateRowAria(row);
    applyTeamFilter();
    markDirty();
    persist(row.querySelectorAll('.bar').length ? '막대를 삭제하고 저장했습니다.' : '마지막 막대를 삭제했습니다. 작업 항목은 그대로 남아 있습니다.');
    if (nextFocus && !row.classList.contains('is-filtered-out')) {
      selectBar(nextFocus);
      nextFocus.focus();
    } else {
      addBarButton.focus();
    }
    return true;
  }

  function wireRow(row) {
    var task = row.querySelector('.task');
    var owner = row.querySelector('.owner');
    syncUiBarTypes(row);

    [task, owner].forEach(function (element) {
      if (!element) return;
      element.contentEditable = 'false';
      element.setAttribute('role', 'textbox');
      element.setAttribute('aria-multiline', element === task ? 'true' : 'false');
      element.setAttribute('aria-label', element === task ? '작업 항목명과 설명' : '담당자');
      element.addEventListener('click', function () {
        if (editOn && element.contentEditable !== 'true') beginTextEdit(element);
      });
      element.addEventListener('input', function () {
        markDirty();
        updateRowAria(row);
      });
      element.addEventListener('keydown', function (event) {
        if (!editOn) return;
        if (element.contentEditable !== 'true' && (event.key === 'Enter' || event.key === 'F2')) {
          event.preventDefault();
          beginTextEdit(element);
          return;
        }
        if (event.key === 'Escape' && element.contentEditable === 'true') {
          event.preventDefault();
          element.innerHTML = element.dataset.beforeEdit || element.innerHTML;
          element.blur();
          updateRowAria(row);
          return;
        }
        if (element === owner && event.key === 'Enter' && element.contentEditable === 'true') {
          event.preventDefault();
          element.blur();
        }
        if (element === task && event.key === 'Enter' && event.ctrlKey && element.contentEditable === 'true') {
          event.preventDefault();
          element.blur();
        }
      });
      element.addEventListener('blur', function () {
        element.contentEditable = 'false';
        delete element.dataset.beforeEdit;
        if (element === owner) syncUiBarTypes(row);
        updateRowAria(row);
        if (element === task) populateBarTaskOptions();
        if (element === owner) applyTeamFilter();
      });
    });

    Array.prototype.slice.call(row.querySelectorAll('.bar')).forEach(function (bar) {
      wireBar(row, bar);
    });

    var deleteButton = document.createElement('button');
    deleteButton.className = 'delete-row';
    deleteButton.type = 'button';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', '작업 항목 삭제');
    deleteButton.addEventListener('click', function () {
      var taskName = task ? task.textContent.trim() : '이 작업';
      if (!window.confirm('“' + taskName + '” 항목을 삭제할까요?')) return;
      if (selectedBar && selectedBar.closest('.row') === row) selectBar(null);
      row.remove();
      renumber();
      populateBarTaskOptions();
      applyTeamFilter();
      markDirty();
      persist('작업 항목을 삭제하고 저장했습니다.');
    });
    row.appendChild(deleteButton);
    updateRowAria(row);
  }

  function setEditMode(on) {
    if (on && !hasEditorAccess()) {
      openAuthModal();
      announce('편집자 로그인 후 수정할 수 있습니다.');
      return;
    }
    var changed = editOn !== Boolean(on);
    editOn = Boolean(on);
    root.classList.toggle('editing', editOn);
    editButton.textContent = editOn ? '편집 종료' : '편집 모드';
    editButton.setAttribute('aria-pressed', String(editOn));
    allRows().forEach(function (row) {
      [row.querySelector('.task'), row.querySelector('.owner')].forEach(function (element) {
        if (!element) return;
        element.tabIndex = editOn ? 0 : -1;
        if (!editOn) element.contentEditable = 'false';
      });
      Array.prototype.slice.call(row.querySelectorAll('.bar')).forEach(function (bar) {
        bar.tabIndex = editOn ? 0 : -1;
        bar.setAttribute('role', editOn ? 'button' : 'img');
        bar.setAttribute('aria-selected', String(editOn && bar === selectedBar));
        if (!editOn) bar.contentEditable = 'false';
      });
      var deleteButton = row.querySelector('.delete-row');
      if (deleteButton) {
        deleteButton.tabIndex = editOn ? 0 : -1;
        deleteButton.setAttribute('aria-hidden', String(!editOn));
      }
    });
    if (!editOn && activeDrag) cleanupDrag(activeDrag.bar);
    if (!editOn) selectBar(null);
    else deleteBarButton.disabled = !selectedBar;
    if (changed) announce(editOn ? '편집 모드를 켰습니다.' : '편집 모드를 종료했습니다.');
  }

  function defaultDateIndex() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var scheduleStart = new Date(2026, 8, 7);
    var index = Math.floor((today.getTime() - scheduleStart.getTime()) / 604800000);
    return clamp(index, 0, 20);
  }

  function markWeek() {
    var selected = clamp(Number(weekSelect.value) || 0, 0, 20);
    Array.prototype.slice.call(document.querySelectorAll('.weeks > div')).forEach(function (element, index) {
      element.classList.toggle('week-current', index === selected + 3);
    });
    allRows().forEach(function (row) {
      var band = row.querySelector('.week-band');
      if (!band) {
        band = document.createElement('div');
        band.className = 'week-band';
        band.setAttribute('aria-hidden', 'true');
        row.appendChild(band);
      }
      band.style.gridColumn = selected + 4 + ' / ' + (selected + 5);
    });
    try {
      localStorage.setItem(WEEK_KEY, String(selected));
    } catch (error) {}
  }

  function openModal() {
    if (!editOn) setEditMode(true);
    if (!editOn) return;
    lastFocused = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if ('inert' in main) main.inert = true;
    window.setTimeout(function () {
      document.getElementById('newTask').focus();
    }, 0);
  }

  function closeModal(resetForm) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if ('inert' in main) main.inert = false;
    if (resetForm) form.reset();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function rowByKey(key) {
    return allRows().find(function (row) { return row.dataset.key === key; }) || null;
  }

  function populateBarTaskOptions(preferredKey) {
    if (!barTaskSelect) return;
    var previous = preferredKey || barTaskSelect.value;
    var rows = allRows();
    barTaskSelect.innerHTML = '';
    rows.forEach(function (row) {
      var option = document.createElement('option');
      option.value = row.dataset.key;
      option.textContent = (row.querySelector('.id') ? row.querySelector('.id').textContent.trim() : '') + ' · ' + taskNameForRow(row);
      barTaskSelect.appendChild(option);
    });
    if (previous && rowByKey(previous)) barTaskSelect.value = previous;
    else {
      var firstVisible = rows.find(function (row) { return !row.classList.contains('is-filtered-out'); });
      if (firstVisible) barTaskSelect.value = firstVisible.dataset.key;
    }
    barTaskSelect.disabled = rows.length === 0;
    var submit = barForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = rows.length === 0;
    updateBarTeamHint();
  }

  function updateBarTeamHint() {
    var row = rowByKey(barTaskSelect.value);
    if (!row) {
      barTeamHint.textContent = '막대를 추가할 작업 항목이 없습니다.';
      return;
    }
    var owner = row.querySelector('.owner') ? row.querySelector('.owner').textContent.trim() : '미정';
    var type = typeForRole(row.dataset.area, owner);
    var steam = row.dataset.area === 'steam' || STEAM_AREAS.indexOf(row.dataset.area) !== -1;
    barTeamHint.textContent = '막대 색상: ' + TEAM_LABELS[type] + ' · 담당: ' + owner + (steam ? ' · Steam 준비 항목은 PM 색상으로 고정' : '');
  }

  function openBarModal() {
    if (!editOn) setEditMode(true);
    if (!editOn) return;
    lastFocused = document.activeElement;
    var preferredRow = selectedBar ? selectedBar.closest('.row') : null;
    populateBarTaskOptions(preferredRow ? preferredRow.dataset.key : '');
    var selectedDate = clamp(Number(weekSelect.value) || 0, 0, 20) + 1;
    barStartSelect.value = String(selectedDate);
    barEndSelect.value = String(selectedDate);
    barModal.classList.add('open');
    barModal.setAttribute('aria-hidden', 'false');
    if ('inert' in main) main.inert = true;
    window.setTimeout(function () { barLabelInput.focus(); }, 0);
  }

  function closeBarModal(resetForm) {
    barModal.classList.remove('open');
    barModal.setAttribute('aria-hidden', 'true');
    if ('inert' in main) main.inert = false;
    if (resetForm) barForm.reset();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function handleModalKeydown(event, modalElement, closeFunction) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFunction(false);
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(
      modalElement.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function addBarFromValues(values, saveImmediately) {
    var row = rowByKey(String(values.taskKey || ''));
    if (!row) throw new Error('막대를 추가할 작업 항목을 선택해 주세요.');
    var label = String(values.label || '').trim().slice(0, 160);
    if (!label) throw new Error('막대 이름을 입력해 주세요.');
    var startWeek = clamp(Number(values.startWeek) || 1, 1, 21);
    var endWeek = clamp(Number(values.endWeek) || startWeek, startWeek, 21);
    var start = startWeek + 3;
    var end = endWeek + 4;
    if (rangesOverlap(row, start, end, null)) throw new Error('같은 작업의 다른 막대와 기간이 겹칩니다. 비어 있는 날짜를 선택해 주세요.');
    var owner = row.querySelector('.owner') ? row.querySelector('.owner').textContent.trim() : '';
    var bar = document.createElement('div');
    bar.className = 'bar ' + typeForRole(row.dataset.area, owner);
    bar.dataset.key = makeStableKey('bar');
    bar.textContent = label;
    bar.style.gridColumn = start + ' / ' + end;
    row.appendChild(bar);
    wireBar(row, bar);
    updateRowAria(row);
    markWeek();
    setEditMode(true);
    applyTeamFilter();
    if (saveImmediately) {
      markDirty();
      persist('막대를 추가하고 저장했습니다.');
    }
    else markDirty();
    return bar;
  }

  function addTaskFromValues(values, saveImmediately) {
    var task = String(values.task || '').trim().slice(0, 160);
    if (!task) throw new Error('작업 항목명을 입력해 주세요.');
    var owner = String(values.owner || '전원').trim().slice(0, 120) || '전원';
    var area = VALID_AREAS.indexOf(values.area) !== -1 ? values.area : '아웃게임';
    var startWeek = clamp(Number(values.startWeek) || 1, 1, 21);
    var endWeek = clamp(Number(values.endWeek) || startWeek, startWeek, 21);
    var model = {
      key: makeStableKey('custom'),
      area: area,
      taskHtml: task,
      owner: owner,
      bars: [{
        text: task,
        start: startWeek + 3,
        end: endWeek + 4,
        type: typeForRole(area, owner)
      }]
    };
    var row = createRow(model);
    insertByArea(row, area);
    wireRow(row);
    renumber();
    populateBarTaskOptions(row.dataset.key);
    markWeek();
    setEditMode(editOn);
    applyTeamFilter();
    if (saveImmediately) {
      markDirty();
      persist('작업 항목을 추가하고 저장했습니다.');
    }
    else markDirty();
    return {
      key: model.key,
      task: task,
      owner: owner,
      area: area,
      startWeek: startWeek,
      endWeek: endWeek
    };
  }

  function installAccessibility() {
    var description = document.createElement('p');
    description.id = 'boardDescription';
    description.className = 'visually-hidden';
    description.textContent = '작업별 담당자와 2026년 9월 7일부터 2027년 1월 25일까지의 일정을 보여 주는 간트차트입니다. 가로와 세로로 스크롤할 수 있습니다.';
    board.parentNode.insertBefore(description, board);
    board.setAttribute('aria-describedby', description.id);
    var weeks = document.querySelector('.weeks');
    weeks.setAttribute('role', 'row');
    Array.prototype.slice.call(weeks.children).forEach(function (cell) {
      cell.setAttribute('role', 'columnheader');
    });
    phases.forEach(function (phase) {
      var name = phase.querySelector('.phase-name');
      if (name) {
        name.setAttribute('role', 'heading');
        name.setAttribute('aria-level', '2');
      }
    });
  }

  function registerModelTools() {
    var context = document.modelContext;
    if (!context || typeof context.registerTool !== 'function') return;
    var lifecycle = new AbortController();

    function register(tool) {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(function () {});
      } catch (error) {}
    }

    register({
      name: 'add_gantt_task',
      title: '간트 작업 추가',
      description: 'Save The Spirit 개발 간트차트에 새 작업을 추가하고 브라우저에 저장합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', minLength: 1, maxLength: 160 },
          owner: { type: 'string', maxLength: 120 },
          area: { type: 'string', enum: VALID_AREAS },
          startWeek: { type: 'integer', minimum: 1, maximum: 21 },
          endWeek: { type: 'integer', minimum: 1, maximum: 21 }
        },
        required: ['task', 'area', 'startWeek', 'endWeek'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: function (input) {
        if (!hasEditorAccess()) throw new Error('편집자 로그인이 필요합니다.');
        if (!input || typeof input !== 'object') throw new Error('입력값이 필요합니다.');
        if (typeof input.task !== 'string' || !input.task.trim() || input.task.length > 160) {
          throw new Error('작업 항목명은 1자 이상 160자 이하로 입력해 주세요.');
        }
        if (input.owner !== undefined && (typeof input.owner !== 'string' || input.owner.length > 120)) {
          throw new Error('담당자는 120자 이하로 입력해 주세요.');
        }
        if (VALID_AREAS.indexOf(input.area) === -1) throw new Error('올바른 카테고리를 선택해 주세요.');
        if (!Number.isInteger(input.startWeek) || !Number.isInteger(input.endWeek)) {
          throw new Error('시작일과 종료일을 선택해 주세요.');
        }
        if (input.startWeek < 1 || input.startWeek > 21 || input.endWeek < 1 || input.endWeek > 21) {
          throw new Error('일정 범위 안의 날짜를 선택해 주세요.');
        }
        if (input.endWeek < input.startWeek) throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
        var result = addTaskFromValues(input, true);
        return { status: 'added', task: result };
      }
    });

    register({
      name: 'get_gantt_plan_summary',
      title: '간트 계획 요약',
      description: '현재 화면의 작업 수와 선택된 시작일을 읽습니다.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: function () {
        return {
          taskCount: allRows().length,
          currentDate: DATE_LABELS[clamp(Number(weekSelect.value) || 0, 0, 20)],
          hasUnsavedChanges: dirty
        };
      }
    });

    window.addEventListener('pagehide', function () {
      lifecycle.abort();
    }, { once: true });
  }

  var toast = document.createElement('div');
  toast.id = 'statusToast';
  toast.className = 'status-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  root.appendChild(toast);

  filterEmpty = document.createElement('div');
  filterEmpty.className = 'filter-empty';
  filterEmpty.textContent = '선택한 담당의 작업이 없습니다.';
  filterEmpty.setAttribute('role', 'status');
  board.insertBefore(filterEmpty, phases[0]);

  prepareStructure();
  installAccessibility();
  allRows().forEach(wireRow);
  renumber();

  DATE_LABELS.forEach(function (name, index) {
    var currentOption = document.createElement('option');
    currentOption.value = String(index);
    currentOption.textContent = name;
    weekSelect.appendChild(currentOption);

    ['newStart', 'newEnd', 'barStart', 'barEnd'].forEach(function (id) {
      var dateOption = document.createElement('option');
      dateOption.value = String(index + 1);
      dateOption.textContent = name;
      document.getElementById(id).appendChild(dateOption);
    });
  });
  try {
    var savedWeek = localStorage.getItem(WEEK_KEY);
    weekSelect.value = savedWeek === null ? String(defaultDateIndex()) : savedWeek;
  } catch (error) {
    weekSelect.value = String(defaultDateIndex());
  }
  markWeek();
  setEditMode(false);
  populateBarTaskOptions();
  applyTeamFilter();

  editButton.addEventListener('click', function () {
    setEditMode(!editOn);
  });
  addButton.addEventListener('click', openModal);
  addBarButton.addEventListener('click', openBarModal);
  deleteBarButton.addEventListener('click', deleteSelectedBar);
  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var team = button.dataset.team;
      if (team === 'all') activeTeams.clear();
      else if (activeTeams.has(team)) activeTeams.delete(team);
      else activeTeams.add(team);
      applyTeamFilter();
    });
  });
  saveButton.addEventListener('click', function () {
    persist('공용 일정에 저장했습니다.');
  });
  resetButton.addEventListener('click', async function () {
    if (dirty && !window.confirm('이 화면에서 아직 저장하지 않은 변경을 버리고 공용 최신본을 불러올까요?')) return;
    dirty = false;
    saveQueued = false;
    pendingRemoteRecord = null;
    saveButton.classList.remove('has-changes');
    saveButton.textContent = '공용 저장';
    await loadSharedPlan({ force: true });
  });
  weekSelect.addEventListener('change', markWeek);
  cancelButton.addEventListener('click', function () { closeModal(true); });
  cancelBarButton.addEventListener('click', function () { closeBarModal(true); });
  barTaskSelect.addEventListener('change', updateBarTeamHint);
  barStartSelect.addEventListener('change', function () {
    if (Number(barEndSelect.value) < Number(barStartSelect.value)) barEndSelect.value = barStartSelect.value;
  });

  loginEditorButton.addEventListener('click', openAuthModal);
  cancelAuthButton.addEventListener('click', closeAuthModal);
  logoutEditorButton.addEventListener('click', async function () {
    if (dirty && !window.confirm('아직 저장하지 않은 변경이 있습니다. 로그아웃할까요?')) return;
    await sharedClient.auth.signOut();
    announce('로그아웃했습니다.');
  });
  manageEditorsButton.addEventListener('click', function () {
    if (editorRole !== 'owner') return;
    lastFocused = document.activeElement;
    memberModal.classList.add('open');
    memberModal.setAttribute('aria-hidden', 'false');
    if ('inert' in main) main.inert = true;
    loadEditors();
    window.setTimeout(function () { memberEmailInput.focus(); }, 0);
  });
  closeMembersButton.addEventListener('click', closeMemberModal);

  authForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!sharedClient) return;
    var email = authEmailInput.value.trim().toLowerCase();
    if (!email) return;
    sendMagicLinkButton.disabled = true;
    authFeedback.textContent = '로그인 링크를 보내는 중입니다.';
    var result = await sharedClient.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        shouldCreateUser: true
      }
    });
    sendMagicLinkButton.disabled = false;
    if (result.error) {
      authFeedback.textContent = '로그인 링크를 보내지 못했습니다. 이메일을 확인하고 다시 시도해 주세요.';
      return;
    }
    authFeedback.textContent = '메일을 보냈습니다. 받은 편지함의 로그인 링크를 눌러 주세요.';
  });

  memberForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!sharedClient || editorRole !== 'owner') return;
    var email = memberEmailInput.value.trim().toLowerCase();
    if (!email) return;
    var result = await sharedClient.from('gantt_editors').insert({ email: email, role: 'editor' });
    if (result.error) {
      announce('추가하지 못했습니다. 이미 등록된 이메일인지 확인해 주세요.');
      return;
    }
    memberForm.reset();
    announce('편집자를 추가했습니다.');
    loadEditors();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    try {
      addTaskFromValues({
        task: document.getElementById('newTask').value,
        owner: document.getElementById('newOwner').value,
        area: document.getElementById('newType').value,
        startWeek: document.getElementById('newStart').value,
        endWeek: document.getElementById('newEnd').value
      }, true);
      closeModal(true);
    } catch (error) {
      announce(error.message || '작업 항목을 추가하지 못했습니다.');
    }
  });

  barForm.addEventListener('submit', function (event) {
    event.preventDefault();
    try {
      var bar = addBarFromValues({
        taskKey: barTaskSelect.value,
        label: barLabelInput.value,
        startWeek: barStartSelect.value,
        endWeek: barEndSelect.value
      }, true);
      closeBarModal(true);
      if (!bar.closest('.row').classList.contains('is-filtered-out')) {
        selectBar(bar);
        bar.focus();
      }
    } catch (error) {
      announce(error.message || '막대를 추가하지 못했습니다.');
    }
  });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal(false);
  });
  modal.addEventListener('keydown', function (event) {
    handleModalKeydown(event, modal, closeModal);
  });
  barModal.addEventListener('click', function (event) {
    if (event.target === barModal) closeBarModal(false);
  });
  barModal.addEventListener('keydown', function (event) {
    handleModalKeydown(event, barModal, closeBarModal);
  });
  authModal.addEventListener('click', function (event) {
    if (event.target === authModal) closeAuthModal();
  });
  authModal.addEventListener('keydown', function (event) {
    handleModalKeydown(event, authModal, closeAuthModal);
  });
  memberModal.addEventListener('click', function (event) {
    if (event.target === memberModal) closeMemberModal();
  });
  memberModal.addEventListener('keydown', function (event) {
    handleModalKeydown(event, memberModal, closeMemberModal);
  });

  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  registerModelTools();
  initializeSharedApp();

  window.addEventListener('pagehide', function () {
    if (authSubscription) authSubscription.unsubscribe();
    if (sharedClient && sharedChannel) sharedClient.removeChannel(sharedChannel);
  }, { once: true });
})();
