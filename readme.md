# The SpaceX ISS Docking simulator
Yesterday i found the iss docking simulator that spacex had put online: 

https://iss-sim.spacex.com/

Before encountering this, i had been reading a lot about the apollo guidance computer. It was an amazing piece of hardware and software.

Playing the spacex simulator proved that flying a spacecraft is really not that easy. The key to getting it to dock is patience! Make small corrections, and don't make too many corrections at the same time. While playing 

So, inspired by the heroes of MIT who created the guidance computer, and frustrated by my lack of pilotting skills, i decided there was only one sane thing to do: write an autopilot!

I'm using [tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=nl) to run this script inside chrome.

Please don't use this code to fly an actual spaceship. In fact, please don't use javascript to fly a spaceship. 

The autopilot detects the userinterface state, and starts pilotting when the interface is ready. It has a sequence of programs that guide the spaceship to its target:

* orient: roll, pitch and yaw errors are minimized
* translate: y and z errors are minimized
* approach: flies to the spacestation to a hold position at 20 meters
* translate: same as above, but with greater precision
* dock: flies the last 20 meters very slowly, making continuous translation corrections.

## This is not a real autopilot
I've tested this a couple of times, success rate so far is 100% (no spacestations were hurt during these tests.) I haven't tested what happens if the starting position is different, or if you mess with the controls during operation. Also, when you click 'abort', the autopilot will stop clicking buttons. That does not mean the spacecraft will stop moving. A real autopilot should retreat to a safe position when the abort is triggered.

## Installation
The easy way to install this is to go to the tampermonkey dashboard, click the 'tools' tab, and use the 'Install from URL' function.

Another way is to click the '+' tab, and copy all of autopilot.js inside the editor. 

If you want to work on this script, it is nice if you can use your own editor to do it. To achieve this, you can put the script somewhere in your homefolder (by cloning this repo). Then, in chome, in your extensions settings go to tampermonkey, and enable 'Allow access to file URLs' (be aware that other scripts running in tampermonkey will now get access to all your files!)

Then, add a new script to tamper monkey, and add the following line:

```
// @require      file:///path/to/autopilot.js
```

