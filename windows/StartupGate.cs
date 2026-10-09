using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

class StartupGate : ApplicationContext {
    delegate void EventProc(IntPtr hook,uint ev,IntPtr window,int obj,int child,uint thread,uint time);
    delegate bool EnumProc(IntPtr window,IntPtr data);
    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,EventProc callback,uint process,uint thread,uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr data);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder text,int length);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr window,int index,int value);
    [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr window,uint color,byte alpha,uint flags);
    [DllImport("user32.dll")] static extern bool GetLayeredWindowAttributes(IntPtr window,out uint color,out byte alpha,out uint flags);
    [StructLayout(LayoutKind.Sequential)] struct Rect {public int Left,Top,Right,Bottom;}
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
    readonly string exe, arguments, ready;
    readonly HashSet<IntPtr> hidden=new HashSet<IntPtr>();
    readonly Dictionary<IntPtr,int> styles=new Dictionary<IntPtr,int>();
    readonly Timer timer=new Timer {Interval=16};
    readonly Stopwatch clock=new Stopwatch();
    readonly EventProc callback;
    IntPtr hook;
    bool finished,released;
    StartupGate(string[] args) {
        exe=Path.GetFullPath(args[0]);arguments=args[1];ready=args[2];
        callback=OnWindow;
        hook=SetWinEventHook(0x8000,0x8002,IntPtr.Zero,callback,0,0,2);
        timer.Tick+=(s,e)=>{
            EnumWindows((window,data)=>{HideAppWindow(window);return true;},IntPtr.Zero);
            if(released){if(File.Exists(ready+".pet-visible")||clock.Elapsed.TotalSeconds>12)ExitGate();}
            else if(File.Exists(ready)||clock.Elapsed.TotalSeconds>45)Finish();
        };
        clock.Start();timer.Start();
        try {Process.Start(new ProcessStartInfo(exe,arguments) {UseShellExecute=false,WindowStyle=ProcessWindowStyle.Hidden});}
        catch {timer.Interval=1;timer.Tick+=(s,e)=>Finish();}
    }
    void OnWindow(IntPtr h,uint ev,IntPtr window,int obj,int child,uint thread,uint time) {
        if(obj==0 && child==0)HideAppWindow(window);
    }
    void HideAppWindow(IntPtr window) {
        if(finished || !IsWindow(window))return;
        var name=new StringBuilder(128);GetClassName(window,name,128);
        if(name.ToString()!="Chrome_WidgetWin_1")return;
        uint pid;GetWindowThreadProcessId(window,out pid);
        try {
            using(var process=Process.GetProcessById((int)pid))
                if(process.SessionId==Process.GetCurrentProcess().SessionId && String.Equals(process.MainModule.FileName,exe,StringComparison.OrdinalIgnoreCase)) {
                    Rect bounds;GetWindowRect(window,out bounds);
                    int exStyle=GetWindowLong(window,-20);
                    bool smallOverlay=(exStyle&0x80)!=0 || (bounds.Right-bounds.Left<=640 && bounds.Bottom-bounds.Top<=640);
                    if(smallOverlay){
                        // The pet must be physically visible independently of the main-window gate.
                        bool onScreen=false;
                        var rectangle=new Rectangle(bounds.Left,bounds.Top,bounds.Right-bounds.Left,bounds.Bottom-bounds.Top);
                        foreach(var screen in Screen.AllScreens)if(screen.Bounds.IntersectsWith(rectangle)){onScreen=true;break;}
                        if(onScreen&&IsWindowVisible(window)&&!File.Exists(ready+".pet-visible")){
                            uint color,flags;byte alpha;
                            bool transparent=GetLayeredWindowAttributes(window,out color,out alpha,out flags)&&(flags&2)!=0&&alpha==0;
                            if(!transparent)try{File.WriteAllText(ready+".pet-visible",DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());}catch{}
                        }
                        return;
                    }
                    if(released)return;
                    if(!styles.ContainsKey(window))styles[window]=GetWindowLong(window,-20);
                    hidden.Add(window);
                    SetWindowLong(window,-20,styles[window]|0x80000);
                    SetLayeredWindowAttributes(window,0,0,2);
                }
        }catch { }
    }
    void Finish() {
        if(finished||released)return;released=true;
        IntPtr last=IntPtr.Zero;
        foreach(var window in hidden)if(IsWindow(window)){
            SetLayeredWindowAttributes(window,0,255,2);
            SetWindowLong(window,-20,styles[window]);
            if(IsWindowVisible(window))last=window;
        }
        if(last!=IntPtr.Zero)SetForegroundWindow(last);
        try {File.WriteAllText(ready+".shown","shown");}catch { }
        try {if(File.Exists(ready))File.Delete(ready);}catch { }
        clock.Restart();timer.Interval=100;
        if(File.Exists(ready+".pet-visible"))ExitGate();
    }
    void ExitGate(){
        if(finished)return;finished=true;
        timer.Stop();timer.Dispose();
        if(hook!=IntPtr.Zero)UnhookWinEvent(hook);
        ExitThread();
    }
    [STAThread] static void Main(string[] args) {
        if(args.Length<3)return;
        try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch { }
        Application.EnableVisualStyles();Application.Run(new StartupGate(args));
    }
}
