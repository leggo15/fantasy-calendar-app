# DND Calendar — DM Edition

import json, os, tkinter as tk
from tkinter import ttk, simpledialog, messagebox
import textwrap

# ───────── CONFIG ─────────
DAYS_IN_WEEK = 7
STRANDS_FILE = r"C:\Projects\DND-tools\fantasy-calendar-app\player-calendar-wheel\public\strands.json"
NOTES_FILE   = r"C:\Projects\DND-tools\fantasy-calendar-app\player-calendar-wheel\public\day_notes.json"
BASE_MONTH_LENGTHS   = [31,28,31,30,31,30,31,31,30,31,30,31]
DAYS_IN_MAGIC_SEASON = 59
SEASONS       = ["Winter","Spring","Summer","Fall"]
MAGIC_SEASONS = ["Low","Mid","High"]

# ───────── DATE + HOUR HELPERS ─────────
def is_leap(y): return y%4==0
def year_length(y): return 366 if is_leap(y) else 365
def month_lengths_for(y):
    ml=BASE_MONTH_LENGTHS.copy()
    if is_leap(y): ml[1]=29
    return ml

# ───────── CORE MODEL ─────
class FantasyCalendar:
    STATE_FILE = r"C:\Projects\DND-tools\fantasy-calendar-app\player-calendar-wheel\public\current_date.txt"
    HOUR_FILE  = r"C:\Projects\DND-tools\fantasy-calendar-app\player-calendar-wheel\public\current_hour.txt"

    def __init__(self):
        self.months=["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
        
        self.magic_seasons=MAGIC_SEASONS
        self.seasons=SEASONS
        self._load_strands()
        self._load_notes()
        self.total_days = self._load_state()
        self.current_hour = self._load_hour()

    # ----- JSON -----    
    def _load_json(self,fname,default):
        p=os.path.join(os.path.dirname(__file__),fname)
        try:
            data = json.load(open(p,encoding="utf-8"))
        except FileNotFoundError:
            data = default
        return data,p

    def _load_strands(self):
        blank={"Name":"","Hidden":"No","Description":"","Low_Effect":"","Mid_Effect":"","High_Effect":""}
        raw,_=self._load_json(STRANDS_FILE,{})
        self.strand_effect={i:raw.get(str(i),blank.copy()) for i in range(1,97)}

    def _load_notes(self):
        self.notes,self._notes_path=self._load_json(NOTES_FILE,{})

    def _save_notes(self):
        json.dump(self.notes, open(self._notes_path,"w",encoding="utf-8"), indent=2, ensure_ascii=False)

    # ----- entry -----    
    def _key(self,off=0):
        return str(self.total_days+off)

    def _entry(self):
        e=self.notes.setdefault(self._key(),{"party":"","events":[]})
        # upgrade old schema if needed
        for ev in e["events"]:
            if "name" not in ev:
                ev["name"]=ev.pop("text")
                ev.setdefault("desc","")
        return e

    # ----- Party log -----    
    def get_party(self): return self._entry()["party"]

    def set_party(self,txt):
        ent=self._entry()
        ent["party"]=txt
        if not ent["party"] and not ent["events"]:
            self.notes.pop(self._key(),None)
        self._save_notes()

    # ----- Event storage -----    
    def add_event(self,ev):
        self._entry()["events"].append(ev)
        self._save_notes()

    def edit_event(self,dkey,idx,new):
        self.notes[dkey]["events"][idx].update(new)
        self._save_notes()

    def del_event(self,dkey,idx):
        self.notes[dkey]["events"].pop(idx)
        if not self.notes[dkey]["events"] and not self.notes[dkey].get("party"):
            self.notes.pop(dkey)
        self._save_notes()

    # ----- date math -----    
    def _comp(self,off=0):
        d=self.total_days+off
        y=0
        while d>=year_length(y):
            d-=year_length(y); y+=1
        ml=month_lengths_for(y)
        m=0
        while d>=ml[m]:
            d-=ml[m]; m+=1
        return dict(
            year=y,
            month=m,
            day=d+1,
            season=m//3%4,
            magic=(self.total_days+off)//DAYS_IN_MAGIC_SEASON%3,
            strand=(self.total_days+off)//DAYS_IN_WEEK%96
        )

    # ----- pretty helpers -----    
    def _vis_name(self,sid):
        i=self.strand_effect[sid]
        return "" if i["Hidden"].lower()=="yes" else i["Name"].strip()

    @staticmethod
    def _suf(n):
        return "th" if 10<=n%100<=20 else {1:"st",2:"nd",3:"rd"}.get(n%10,"th")

    def _fmt(self,c):
        mon=self.months[c["month"]]; d=c["day"]
        mag=MAGIC_SEASONS[c["magic"]]; sea=SEASONS[c["season"]]
        sid=c["strand"]+1; strand=f"Strand of {self._vis_name(sid)}" if self._vis_name(sid) else "No Strand"
        return f"{mon} {d}{self._suf(d)} {mag} {sea}, {strand}({sid}) Of the year {c['year']}."

    # ----- matching -----    
    def _match(self,ev,comp):
        rule,sid=ev["rule"],comp["strand"]+1
        month,day=comp["month"],comp["day"]
        sea=SEASONS[comp["season"]]; msea=MAGIC_SEASONS[comp["magic"]]
        if rule=="one":
            return ev["y"]==comp["year"] and ev["m"]==month and ev["d"]==day
        if rule=="yearly":
            return ev["m"]==month and ev["d"]==day
        if ev["sid"]!=sid:
            return False
        if rule=="strand":
            return True
        if rule=="strand+season":
            return ev["season"]==sea
        if rule=="strand+mag":
            return ev["mseason"]==msea
        if rule=="strand+both":
            return ev["season"]==sea and ev["mseason"]==msea
        return False

    # ----- iterate all events -----    
    def all_events(self):
        for dkey,ent in self.notes.items():
            for idx,ev in enumerate(ent.get("events",[])):
                yield dkey,idx,ev

    # ----- today active -----    
    def active_events(self):
        comp=self._comp()
        out=[]
        for dkey,idx,ev in self.all_events():
            if self._match(ev,comp):
                e=dict(ev); e.update(__day=dkey,__idx=idx)
                out.append(e)
        return out

    # ----- next dates (week hop for strand rules) -----    
    def next_dates_for(self,ev,n=5):
        res=[]; off=1; limit=year_length(0)*400
        weekly=ev["rule"].startswith("strand")
        while len(res)<n and off<limit:
            c=self._comp(off)
            if self._match(ev,c):
                res.append(self._fmt(c))
                off += (DAYS_IN_WEEK if weekly else 1)
            else:
                off+=1
        return res

    # ----- same combo -----    
    def next_same_combo(self,n=10):
        cur=self._comp(); res=[]; off=DAYS_IN_WEEK
        while len(res)<n and off<year_length(0)*400:
            c=self._comp(off)
            if c["strand"]==cur["strand"] and c["magic"]==cur["magic"]:
                res.append(self._fmt(c))
            off+=DAYS_IN_WEEK
        return res

    # ----- banner / effect -----    
    def format_date(self):
        c=self._comp()
        mon=self.months[c["month"]]; d=c["day"]
        sid=c["strand"]+1; mag=MAGIC_SEASONS[c["magic"]]; sea=SEASONS[c["season"]]
        strand=f"Strand of {self._vis_name(sid)}" if self._vis_name(sid) else "No Strand"
        date_str = f"{mon} {d}{self._suf(d)} {mag} {sea}, {strand}({sid}) Of the year {c['year']}."
        return f"{self.current_hour:02d}:00 — {date_str}"

    def current_strand_effect(self):
        sid=self._comp()["strand"]+1; d=self.strand_effect[sid]
        if d["Hidden"].lower()=="yes" or not any(v for k,v in d.items() if k!="Hidden"):
            return "No Effects."
        return (f"Name: {d['Name'] or 'Unnamed Strand'}\n"
                f"Description: {d['Description'] or '—'}\n"
                f"Low_Effect: {d['Low_Effect'] or '—'}\n"
                f"Mid_Effect: {d['Mid_Effect'] or '—'}\n"
                f"High_Effect: {d['High_Effect'] or '—'}")

    # ----- state (days) -----    
    def _load_state(self):
        try:
            return int(open(self.STATE_FILE).read().strip())
        except:
            open(self.STATE_FILE,"w").write("0")
            return 0

    def shift_days(self,d):
        self.total_days += d
        open(self.STATE_FILE,"w").write(str(self.total_days))

    # ----- state (hours) -----    
    def _load_hour(self):
        try:
            return int(open(self.HOUR_FILE).read().strip())
        except:
            open(self.HOUR_FILE,"w").write("0")
            return 0

    def _save_hour(self):
        open(self.HOUR_FILE,"w").write(str(self.current_hour))

    def shift_hours(self,h):
        old = self.current_hour
        new = (old + h) % 24
        # if we wrap past midnight forward:
        if old == 23 and new == 0:
            self.shift_days(1)
        # if we wrap backward before midnight:
        if old == 0 and new == 23:
            self.shift_days(-1)
        self.current_hour = new
        self._save_hour()

# ───────── UI ────────
class CalendarApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Strand Calendar — DM Edition")
        self.cal = FantasyCalendar()

        # Date label (row 0)
        self.date_lbl = ttk.Label(self, font=("Segoe UI",14))
        self.date_lbl.grid(row=0, column=0, columnspan=4, padx=10, pady=4)

        # Hour label (row 1)
        self.hour_lbl = ttk.Label(self, font=("Segoe UI",12))
        self.hour_lbl.grid(row=1, column=0, columnspan=4, padx=10, pady=(0,8))

        # Day-shift buttons (row 2)
        for i,(txt,d) in enumerate([
            ("◀ Prev Day",-1),
            ("Next Day ▶",1),
            ("+7 Days",7),
            ("+30 Days",30),
        ]):
            ttk.Button(
                self,
                text=txt,
                command=lambda k=d: self.move_day(k)
            ).grid(row=2, column=i, sticky="ew", padx=2, pady=2)

        # Hour-shift buttons (row 3)
        ttk.Button(
            self,
            text="◀ Prev Hour",
            command=lambda: self.move_hour(-1)
        ).grid(row=3, column=0, columnspan=2, sticky="ew", padx=2, pady=2)
        ttk.Button(
            self,
            text="Next Hour ▶",
            command=lambda: self.move_hour(1)
        ).grid(row=3, column=2, columnspan=2, sticky="ew", padx=2, pady=2)

        # Combo / Effects buttons (row 4)
        ttk.Button(
            self,
            text="Next 10 Same Combo",
            command=self.show_combo
        ).grid(row=4, column=0, columnspan=2, sticky="ew", padx=2, pady=2)
        ttk.Button(
            self,
            text="Show Effects",
            command=self.show_effect
        ).grid(row=4, column=2, columnspan=2, sticky="ew", padx=2, pady=2)

        # Output text area (row 5)
        self.output = tk.Text(self, width=72, height=12, wrap="word")
        self.output.grid(row=5, column=0, columnspan=4, padx=10, pady=10)

        # Notes frame (row 6)
        self.notes_frame = ttk.Frame(self)
        self.notes_frame.grid(row=6, column=0, columnspan=4, sticky="ew", padx=10, pady=5)

        self.refresh()

    # ----- move day/hour -----    
    def move_day(self,d):
        self.cal.shift_days(d)
        self.refresh()

    def move_hour(self,h):
        self.cal.shift_hours(h)
        self.refresh()

    # ----- Party log -----    
    def party_changed(self,e):
        self.cal.set_party(self.party_txt.get("1.0","end-1c"))

    def make_party(self):
        # clear everything, then rebuild Party box + events
        for w in self.notes_frame.winfo_children():
            w.destroy()

        self.party_txt = tk.Text(
            self.notes_frame, width=72, height=12, wrap="word"
        )
        self.party_txt.bind("<KeyRelease>", self.party_changed)
        self.party_txt.pack(fill="x", pady=(0, 6))

        # immediately show current events beneath the new party box
        self._draw_events()

        # keep an Add-Event button
        ttk.Button(
            self.notes_frame,
            text="Add Event",
            command=self.add_event_dialog
        ).pack(anchor="w", pady=(4, 0))

    # -------------------------------------------------
    # helper: draw the “Events:” section only
    # -------------------------------------------------
    def _draw_events(self):
        # remove any previous event rows (but keep the party box)
        for w in self.notes_frame.winfo_children():
            if getattr(w, "_is_event_row", False):
                w.destroy()

        self.active = self.cal.active_events()
        if self.active:
            lbl = ttk.Label(
                self.notes_frame,
                text="Events:",
                font=("Segoe UI", 10, "bold")
            )
            lbl._is_event_row = True
            lbl.pack(anchor="w")
            for ev in self.active:
                row = ttk.Frame(self.notes_frame)
                row._is_event_row = True
                row.pack(fill="x", padx=4, pady=2)
                raw = f"• {ev['name']} – {ev.get('desc','')}"
                wrapped = textwrap.fill(raw, width=90)
                ttk.Label(
                    row,
                    text=wrapped,
                    anchor="w",
                    justify="left",
                    wraplength=750
                ).pack(side="left", fill="x", expand=True)
                ttk.Button(
                    row,
                    text="►",
                    width=2,
                    command=lambda e=ev: self.list_next5(e)
                ).pack(side="right")
                ttk.Button(
                    row,
                    text="🗑",
                    width=2,
                    command=lambda e=ev: self.del_event(e)
                ).pack(side="right")
                ttk.Button(
                    row,
                    text="✏",
                    width=2,
                    command=lambda e=ev: self.edit_event_dlg(e)
                ).pack(side="right")

    # ----- Event dialogs -----    
    def add_event_dialog(self):
        comp=self.cal._comp()
        sid=comp["strand"]+1; season=SEASONS[comp["season"]]; mseason=MAGIC_SEASONS[comp["magic"]]
        dlg=tk.Toplevel(self); dlg.title("New Event"); dlg.grab_set()
        ttk.Label(dlg,text="Name:").grid(row=0,column=0,sticky="w")
        name_ent=ttk.Entry(dlg,width=40); name_ent.grid(row=0,column=1,columnspan=3,padx=2,pady=2)
        ttk.Label(dlg,text="Description:").grid(row=1,column=0,sticky="w")
        desc_ent=ttk.Entry(dlg,width=50); desc_ent.grid(row=1,column=1,columnspan=3,padx=2,pady=2)

        rule=tk.StringVar(value="one")
        opts=[("One-off","one"),("Yearly","yearly"),
              (f"Strand {sid}","strand"),
              (f"Strand {sid} + Season {season}","strand+season"),
              (f"Strand {sid} + Magic {mseason}","strand+mag"),
              (f"Strand {sid} + Both Seasons","strand+both")]
        ttk.Label(dlg,text="Recurs when:").grid(row=2,column=0,sticky="w",pady=(4,0))
        for i,(lbl,val) in enumerate(opts):
            ttk.Radiobutton(
                dlg,
                text=lbl,
                variable=rule,
                value=val
            ).grid(row=3+i,column=0,columnspan=4,sticky="w")

        def save():
            nm,ds=name_ent.get().strip(),desc_ent.get().strip()
            if not nm:
                messagebox.showerror("Empty","Name required",parent=dlg)
                return
            ev={"name":nm,"desc":ds,"rule":rule.get(),
                "y":comp["year"],"m":comp["month"],"d":comp["day"],
                "sid":sid,"season":season,"mseason":mseason}
            self.cal.add_event(ev)
            dlg.destroy()
            self.refresh_notes()

        ttk.Button(dlg,text="Add",command=save).grid(row=9,column=3,sticky="e",pady=4)

    def edit_event_dlg(self,ev):
        dlg=tk.Toplevel(self); dlg.title("Edit Event"); dlg.grab_set()
        ttk.Label(dlg,text="Name:").grid(row=0,column=0,sticky="w")
        name_ent=ttk.Entry(dlg,width=40)
        name_ent.insert(0,ev["name"])
        name_ent.grid(row=0,column=1,columnspan=3,padx=2,pady=2)
        ttk.Label(dlg,text="Description:").grid(row=1,column=0,sticky="w")
        desc_ent=ttk.Entry(dlg,width=50)
        desc_ent.insert(0,ev.get("desc",""))
        desc_ent.grid(row=1,column=1,columnspan=3,padx=2,pady=2)

        def save():
            nm,ds=name_ent.get().strip(),desc_ent.get().strip()
            if not nm:
                messagebox.showerror("Empty","Name required",parent=dlg)
                return
            self.cal.edit_event(ev["__day"],ev["__idx"],{"name":nm,"desc":ds})
            dlg.destroy()
            self.refresh_notes()

        ttk.Button(dlg,text="Save",command=save).grid(row=2,column=3,sticky="e",pady=4)

    # ----- Event row buttons -----    
    def list_next5(self,ev):
        self.output.delete("1.0","end")
        for l in self.cal.next_dates_for(ev,5):
            self.output.insert("end",l+"\n")

    def del_event(self,ev):
        if messagebox.askyesno("Delete","Remove this event?",parent=self):
            self.cal.del_event(ev["__day"],ev["__idx"])
            self.refresh_notes()

    # ----- Notes area -----    
    def refresh_notes(self):
        for w in self.notes_frame.winfo_children():
            w.destroy()

        ent=self.cal._entry()
        if ent["party"]:
            self.party_txt=tk.Text(
                self.notes_frame, width=72, height=12, wrap="word"
            )
            self.party_txt.insert("1.0",ent["party"])
            self.party_txt.bind("<KeyRelease>",self.party_changed)
            self.party_txt.pack(fill="x",pady=(0,6))
        else:
            ttk.Button(
                self.notes_frame,
                text="Add Party Log",
                command=self.make_party
            ).pack(anchor="w", pady=(0,6))

        self.active=self.cal.active_events()
        if self.active:
            ttk.Label(
                self.notes_frame,
                text="Events:",
                font=("Segoe UI",10,"bold")
            ).pack(anchor="w")
            for ev in self.active:
                row=ttk.Frame(self.notes_frame)
                row.pack(fill="x",padx=4,pady=2)
                raw_txt   = f"• {ev['name']} – {ev.get('desc','')}"
                wrapped   = textwrap.fill(raw_txt, width=90)
                ttk.Label(
                    row,
                    text=wrapped,
                    anchor="w",
                    justify="left",
                    wraplength=750
                ).pack(side="left", fill="x", expand=True)
                ttk.Button(
                    row,
                    text="►",
                    width=2,
                    command=lambda e=ev:self.list_next5(e)
                ).pack(side="right")
                ttk.Button(
                    row,
                    text="🗑",
                    width=2,
                    command=lambda e=ev:self.del_event(e)
                ).pack(side="right")
                ttk.Button(
                    row,
                    text="✏",
                    width=2,
                    command=lambda e=ev:self.edit_event_dlg(e)
                ).pack(side="right")

        ttk.Button(
            self.notes_frame,
            text="Add Event",
            command=self.add_event_dialog
        ).pack(anchor="w", pady=(4,0))

    # ----- unchanged combo/effect -----    
    def show_combo(self):
        self.output.delete("1.0","end")
        for l in self.cal.next_same_combo():
            self.output.insert("end",l+"\n")

    def show_effect(self):
        self.output.delete("1.0","end")
        txt=self.cal.current_strand_effect()
        self.output.insert("1.0",txt)
        for h in ["Name:","Description:","Low_Effect:","Mid_Effect:","High_Effect:"]:
            idx="1.0"
            while True:
                idx=self.output.search(h,idx,"end")
                if not idx: break
                self.output.tag_add("bold",idx,f"{idx}+{len(h)}c")
                idx=f"{idx}+{len(h)}c"
        self.output.tag_config("bold",font=("Segoe UI",10,"bold"))

    def refresh(self):
        # update both date+hour labels and notes
        self.date_lbl.config(text=self.cal.format_date())
        self.hour_lbl.config(text=f"Current Hour: {self.cal.current_hour:02d}:00")
        self.refresh_notes()

if __name__=="__main__":
    CalendarApp().mainloop()
