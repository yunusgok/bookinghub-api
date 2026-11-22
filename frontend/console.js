const $ = (selector) => document.querySelector(selector);
const resources = ['customers', 'services', 'bookings'];
const state = Object.fromEntries(
  resources.map((name) => [name, { rows: [], offset: 0, hasMore: false }]),
);
let key = '';
let connected = false;
let busy = false;
let generation = 0;
const pending = new Set();
const editing = { customers: null, services: null };
const forms = { customers: $('#customer-form'), services: $('#service-form') };
const singular = { customers: 'customer', services: 'service' };

function notice(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').classList.toggle('error', error);
}
function access() {
  document.querySelectorAll('[data-auth]').forEach((element) => {
    element.disabled = !connected || busy;
  });
  $('#connect-button').disabled = busy;
  $('#connect-button').hidden = connected;
  $('#api-key').hidden = connected;
  $('#disconnect').hidden = !connected;
  $('#connection-state').textContent = connected
    ? 'Tenant connected'
    : 'Not connected';
  $('#connection-state').className = `badge${connected ? ' success' : ''}`;
  resources.forEach((name) => {
    document.querySelector(
      `[data-page="${name}"][data-direction="-1"]`,
    ).disabled = !connected || busy || state[name].offset === 0;
    document.querySelector(
      `[data-page="${name}"][data-direction="1"]`,
    ).disabled = !connected || busy || !state[name].hasMore;
  });
  document.querySelectorAll('.record-actions button').forEach((button) => {
    button.disabled = !connected || busy;
  });
}
function clearResponse() {
  $('#response-status').textContent = 'Ready';
  $('#response-status').className = 'badge';
  $('#response-request').textContent = 'Your next request will appear here.';
  $('#response-id').textContent = 'Request IDs help trace backend responses.';
  $('#response-body').textContent =
    '// Connect your tenant to begin.\n// Authorization headers are never displayed.';
}
function resetForm(name) {
  const prefix = singular[name];
  editing[name] = null;
  forms[name].reset();
  $(`#${prefix}-legend`).textContent = `New ${prefix}`;
  $(`#${prefix}-save`).textContent = `Create ${prefix}`;
  $(`#${prefix}-reset`).hidden = true;
}
function disconnect(
  message = 'Disconnected. The key and loaded records have been cleared.',
  preserveResponse = false,
) {
  generation++;
  key = '';
  connected = false;
  pending.forEach((controller) => controller.abort());
  $('#api-key').value = '';
  resources.forEach((name) => {
    state[name] = { rows: [], offset: 0, hasMore: false };
    render(name);
  });
  Object.keys(forms).forEach(resetForm);
  $('#booking-form').reset();
  $('#booking-filters').reset();
  setDefaultTime();
  if (!preserveResponse) clearResponse();
  notice(message);
  access();
}
async function request(path, method = 'GET', body, show = true) {
  const epoch = generation;
  const controller = new AbortController();
  pending.add(controller);
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    if (epoch !== generation) throw new Error('Connection changed.');
    let result;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('The server returned an unexpected non-JSON response.');
    }
    if (show || !response.ok) {
      $('#response-status').textContent =
        `${response.status} ${response.statusText}`.trim();
      $('#response-status').className =
        `badge ${response.ok ? 'success' : 'error'}`;
      $('#response-request').textContent = `${method} ${path}`;
      $('#response-id').textContent =
        `Request ID: ${response.headers.get('X-Request-ID') ?? 'unavailable'}`;
      $('#response-body').textContent = result
        ? JSON.stringify(result, null, 2)
        : '// 204 No Content';
    }
    if (response.status === 401)
      disconnect(
        'Authentication failed. Enter a valid, non-revoked API key.',
        true,
      );
    if (!response.ok) {
      const retry = response.headers.get('Retry-After');
      throw new Error(
        `${response.status}: ${result?.error?.message ?? 'Request failed.'}${retry ? ` Retry after ${retry} seconds.` : ''}`,
      );
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError')
      throw new Error(
        'Request cancelled or timed out. Refresh the list before retrying a create: the server may have completed it.',
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    pending.delete(controller);
  }
}
async function run(action) {
  if (busy) return;
  const epoch = generation;
  busy = true;
  access();
  notice('Sending request…');
  try {
    await action();
  } catch (error) {
    if (epoch === generation) notice(error.message, true);
  } finally {
    busy = false;
    access();
  }
}
function utc(value) {
  return new Date(`${value}Z`).toISOString();
}
function setDefaultTime() {
  $('#booking-form').elements.startAt.value = new Date(Date.now() + 3600000)
    .toISOString()
    .slice(0, 16);
}
function bookingFilters() {
  const data = { get: (name) => $('#booking-filters').elements[name].value };
  const result = {};
  if (data.get('status')) result.status = data.get('status');
  for (const name of ['from', 'to'])
    if (data.get(name)) result[name] = utc(data.get(name));
  return result;
}
async function load(name, show = true) {
  const query = new URLSearchParams({
    limit: '10',
    offset: String(state[name].offset),
    ...(name === 'bookings' ? bookingFilters() : {}),
  });
  const result = await request(`/v1/${name}?${query}`, 'GET', undefined, show);
  state[name].rows = result.data;
  state[name].hasMore = result.pagination.hasMore;
  render(name);
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function action(label, handler, danger = false) {
  const button = node('button', label, danger ? 'danger' : 'secondary');
  button.type = 'button';
  button.disabled = busy || !connected;
  button.addEventListener('click', handler);
  return button;
}
function edit(name, row) {
  const prefix = singular[name];
  editing[name] = row.id;
  const form = forms[name];
  for (const input of form.querySelectorAll('input[name]')) {
    if (input.type === 'checkbox') input.checked = row[input.name];
    else input.value = row[input.name] ?? '';
  }
  $(`#${prefix}-legend`).textContent = `Edit ${prefix}`;
  $(`#${prefix}-save`).textContent = 'Save changes';
  $(`#${prefix}-reset`).hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.name.focus({ preventScroll: true });
  notice(`Editing ${row.id}. Save changes to send PATCH.`);
}
function render(name) {
  const list = $(`#${name}-list`);
  list.replaceChildren();
  const rows = state[name].rows;
  if (!rows.length)
    list.append(
      node(
        'p',
        connected ? 'No records on this page.' : `Connect to load ${name}.`,
        'empty',
      ),
    );
  for (const row of rows) {
    const card = node('article', undefined, 'record');
    const top = node('div', undefined, 'record-top');
    top.append(
      node(
        'strong',
        name === 'bookings'
          ? `${row.startAt.slice(0, 16).replace('T', ' ')} UTC`
          : row.name,
      ),
    );
    const active = name === 'bookings' ? row.status === 'active' : row.active;
    top.append(
      node(
        'span',
        name === 'bookings' ? row.status : active ? 'Active' : 'Inactive',
        `badge ${active ? 'success' : ''}`,
      ),
    );
    card.append(top);
    if (name === 'customers')
      card.append(
        node('p', `${row.email}${row.phone ? ` · ${row.phone}` : ''}`),
      );
    if (name === 'services')
      card.append(
        node(
          'p',
          `${row.durationMinutes} min${row.description ? ` · ${row.description}` : ''}`,
        ),
      );
    if (name === 'bookings') {
      card.append(
        node('p', `Ends ${row.endAt.slice(0, 16).replace('T', ' ')} UTC`),
      );
      card.append(
        node('p', `Customer: ${row.customerId}`),
        node('p', `Service: ${row.serviceId}`),
      );
    }
    card.append(node('p', row.id, 'record-id'));
    const buttons = node('div', undefined, 'record-actions');
    buttons.append(
      action('Inspect JSON', () =>
        run(async () => {
          await request(`/v1/${name}/${row.id}`);
          notice('Resource loaded.');
        }),
      ),
    );
    if (name !== 'bookings')
      buttons.append(action('Edit', () => edit(name, row)));
    if (active)
      buttons.append(
        action(
          name === 'bookings' ? 'Cancel booking' : 'Deactivate',
          () => {
            const message =
              name === 'bookings'
                ? 'Cancel this booking and free its time slot?'
                : `Deactivate this ${singular[name]}? Existing bookings are retained.`;
            if (!window.confirm(message)) return;
            run(async () => {
              await request(
                `/v1/${name}/${row.id}${name === 'bookings' ? '/cancel' : ''}`,
                name === 'bookings' ? 'POST' : 'DELETE',
              );
              if (editing[name] === row.id) resetForm(name);
              await load(name, false);
              notice(
                name === 'bookings'
                  ? 'Booking cancelled. Its slot is available again.'
                  : 'Record deactivated.',
              );
            });
          },
          true,
        ),
      );
    card.append(buttons);
    list.append(card);
  }
  $(`#${name}-page`).textContent =
    `${state[name].offset + (rows.length ? 1 : 0)}–${state[name].offset + rows.length} · 10 per page`;
  if (name !== 'bookings') {
    const options = $(`#${singular[name]}-options`);
    options.replaceChildren();
    rows
      .filter((row) => row.active)
      .forEach((row) => {
        const option = node('option', row.name);
        option.value = row.id;
        options.append(option);
      });
  }
  access();
}
$('#connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('#api-key').value.trim();
  if (!value || busy) return;
  run(async () => {
    key = value;
    $('#api-key').value = '';
    try {
      await load('customers');
      connected = true;
      await load('services', false);
      await load('bookings', false);
      notice('Connected. You can now test your tenant’s records.');
    } catch (error) {
      if (key) {
        disconnect('Connection failed. Enter your key to retry.', true);
        notice(error.message, true);
      }
      throw error;
    }
  });
});
$('#disconnect').addEventListener('click', () => disconnect());
for (const name of Object.keys(forms)) {
  $(`#${singular[name]}-reset`).addEventListener('click', () =>
    resetForm(name),
  );
  forms[name].addEventListener('submit', (event) => {
    event.preventDefault();
    // Snapshot fields before run() disables the fieldset (disabled fields are omitted by FormData).
    const form = forms[name];
    const data = new FormData(form);
    const body =
      name === 'customers'
        ? {
            name: data.get('name'),
            email: data.get('email'),
            phone: data.get('phone') || null,
          }
        : {
            name: data.get('name'),
            description: data.get('description'),
            durationMinutes: Number(data.get('durationMinutes')),
            active: form.elements.active.checked,
          };
    run(async () => {
      const id = editing[name];
      await request(
        `/v1/${name}${id ? `/${id}` : ''}`,
        id ? 'PATCH' : 'POST',
        body,
      );
      resetForm(name);
      state[name].offset = 0;
      await load(name, false);
      notice(`${singular[name]} ${id ? 'updated' : 'created'}.`);
    });
  });
}
$('#booking-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const body = {
    customerId: data.get('customerId').trim(),
    serviceId: data.get('serviceId').trim(),
    startAt: utc(data.get('startAt')),
  };
  run(async () => {
    await request('/v1/bookings', 'POST', body);
    state.bookings.offset = 0;
    await load('bookings', false);
    notice(
      'Booking created. Submit the same time again to test conflict handling.',
    );
  });
});
// Read filter inputs directly: fieldsets may be disabled while a request is in progress.
$('#booking-filters').addEventListener('submit', (event) => {
  event.preventDefault();
  state.bookings.offset = 0;
  run(async () => {
    await load('bookings');
    notice('Booking filters applied.');
  });
});
document.querySelectorAll('[data-refresh]').forEach((button) =>
  button.addEventListener('click', () =>
    run(async () => {
      await load(button.dataset.refresh);
      notice('Records refreshed.');
    }),
  ),
);
document.querySelectorAll('[data-page]').forEach((button) =>
  button.addEventListener('click', () =>
    run(async () => {
      const name = button.dataset.page;
      const previous = state[name].offset;
      state[name].offset += Number(button.dataset.direction) * 10;
      try {
        await load(name);
      } catch (error) {
        state[name].offset = previous;
        throw error;
      }
      notice('Page loaded.');
    }),
  ),
);
function tab(name, focus = false) {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !selected;
    if (selected && focus) button.focus();
  });
}
document.querySelectorAll('[data-tab]').forEach((button, index) => {
  button.addEventListener('click', () => tab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % 3;
    if (event.key === 'ArrowLeft') next = (index + 2) % 3;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 2;
    if (next !== undefined) {
      event.preventDefault();
      tab(resources[next], true);
    }
  });
});
window.addEventListener('pagehide', () => disconnect());
setDefaultTime();
access();
