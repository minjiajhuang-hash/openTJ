"use client";

import FullCalendar from "@fullcalendar/react";
import type { EventChangeArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";
import { useEffect, useRef, useState } from "react";
import { ContentEditor } from "@/components/content-editor";
import { CourseTabs } from "@/components/course-tabs";
import { ContributionMeta } from "@/components/contribution-meta";
import { PageHeading } from "@/components/page-heading";
import { AsyncForm, Badge, Modal, Panel } from "@/components/ui";
import { dateLabel, visible, type CalendarEvent } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";

type PendingMove = { change: Pick<EventChangeArg, "event" | "revert">; original: CalendarEvent };
const emptyEvents: CalendarEvent[] = [];

export default function CalendarPage() {
  const { data, user, slug, mutate } = useAppData();
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [update, setUpdate] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [move, setMove] = useState<PendingMove | null>(null);
  const calendar = useRef<FullCalendar>(null);
  const events = data?.events ?? emptyEvents;
  const selected = events.find(item => item.id === selectedId) ?? events.find(visible);
  const canChange = (item: CalendarEvent) => Boolean(data?.permissions.canModerate || (item.authorId === user?.id && !item.locked));

  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    const resize = () => calendar.current?.getApi().changeView(query.matches ? "listMonth" : "dayGridMonth");
    resize(); query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const selectLinked = () => {
      const item = events.find(event => event.id === window.location.hash.slice(1));
      if (item) { setSelectedId(item.id); calendar.current?.getApi().gotoDate(item.start); }
    };
    queueMicrotask(selectLinked);
    window.addEventListener("hashchange", selectLinked);
    return () => window.removeEventListener("hashchange", selectLinked);
  }, [events]);
  const changeEvent = (change: Pick<EventChangeArg, "event" | "revert">) => {
    const original = events.find(item => item.id === change.event.id);
    if (!original || !canChange(original)) { change.revert(); return; }
    setSelectedId(original.id); setMove({ change, original });
  };
  const cancelMove = () => { move?.change.revert(); setMove(null); };

  return <>
    <PageHeading course title="Calendar" description="Shared dates and attributed updates. Times are shown in Eastern time." action={<button className="button button-primary" onClick={() => setInitial({})} type="button">Add event</button>} />
    <CourseTabs />
    <div className="notice notice-warning">Dates are student-contributed. Verify them against official teacher sources.</div>
    <div className="calendar-layout">
      <Panel className="calendar-panel"><div className="calendar-wrap">
        <FullCalendar ref={calendar} plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]}
          initialView="dayGridMonth" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth" }}
          buttonIcons={false} buttonText={{ prev: "Previous", next: "Next", month: "Month", week: "Week", day: "Day", list: "Agenda" }} timeZone="America/New_York" dayMaxEvents height="auto"
          eventDrop={changeEvent} eventResize={changeEvent} editable={!move}
          dateClick={({ dateStr, allDay }) => setInitial({ start: dateStr, allDay })}
          eventClick={({ event }) => setSelectedId(event.id)}
          events={events.filter(visible).map(item => ({ id: item.id, title: item.title, start: item.start, end: item.end, allDay: item.allDay, editable: canChange(item), classNames: [`event-${item.kind}`] }))} />
      </div></Panel>
      <aside className="stack" aria-label="Selected calendar item">
        <Panel title="Event details">{selected ? <div className="stack">
          <div className="split wrap"><h3>{selected.title}</h3><Badge>{selected.kind}</Badge></div>
          <p>{dateLabel(selected.start)}{selected.end ? ` – ${dateLabel(selected.end)}` : ""}{selected.allDay ? " · All day" : " ET"}</p>
          <p className="plain-content">{selected.details}</p>
          <ContributionMeta item={selected} kind="CALENDAR_EVENT" />
          <hr /><h3>Shared updates</h3>
          {selected.updates.map(item => <article className="nested-card" id={item.id} key={item.id}><p className="plain-content">{item.body}</p><ContributionMeta eventId={selected.id} item={item} kind="CALENDAR_UPDATE" /></article>)}
          {!selected.updates.length && <p className="empty-state">No updates yet. Add study notes, changes, or reminders for this event.</p>}
          {visible(selected) && <button className="button" type="button" disabled={selected.locked && !data?.permissions.canModerate} onClick={() => setUpdate(true)}>Add attributed update</button>}
        </div> : <p className="empty-state">Select an event or add one to get started.</p>}</Panel>
        {events.some(item => !visible(item)) && <Panel title="Hidden events"><ul className="item-list">{events.filter(item => !visible(item)).map(item => <li key={item.id}><button className="link-button" onClick={() => setSelectedId(item.id)} type="button">{item.title}</button></li>)}</ul></Panel>}
      </aside>
    </div>
    {initial && <ContentEditor initial={initial} kind="CALENDAR_EVENT" onClose={() => setInitial(null)} />}
    {update && selected && <ContentEditor eventId={selected.id} kind="CALENDAR_UPDATE" onClose={() => setUpdate(false)} />}
    {move && <Modal open title="Confirm calendar change" onClose={cancelMove}>
      <AsyncForm label="Save new time" onCancel={cancelMove} onSubmit={async () => {
        const changed = move.change.event;
        await mutate(`/courses/${slug}/content/${move.original.id}`, { version: move.original.version, start: changed.startStr, end: changed.endStr || null, allDay: changed.allDay }, "PATCH");
        setMove(null);
      }}>
        <p>Move <strong>{move.original.title}</strong> from {dateLabel(move.original.start)} to {dateLabel(move.change.event.startStr)}?</p>
        <p>This updates the shared calendar for everyone in the course.</p>
      </AsyncForm>
    </Modal>}
  </>;
}
