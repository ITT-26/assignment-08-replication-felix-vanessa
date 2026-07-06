# Research Documentation
## Research
We initially searched for papers on our own by looking at the papers on GRIPS and searching for interesting topics that had demo videos in the aclm digital library. After that we presented the papers we found the most interesting and were also manageable to do in such a short time frame to each other. We both were quite certain from the start on that we did not want to do anything that depended on hardware, so we did not look anything up in regards to that. These papers were our top contenders: 
- [Lip-Interact: Improving Mobile Device Interaction with Silent Speech Commands](https://dl.acm.org/doi/10.1145/3242587.3242599)
- [Pursuits: Spontaneous Interaction with Displays based onSmooth Pursuit Eye Movement and Moving Targets](https://dl.acm.org/doi/epdf/10.1145/2493432.2493477)
- [EyePointing: A Gaze-Based Selection Technique](https://dl.acm.org/doi/epdf/10.1145/3340764.3344897)
- [GlassHands: Interaction Around Unmodified Mobile Devices Using Sunglasses](https://dl.acm.org/doi/10.1145/2992154.2992162)
- [Inclusive Voice Interaction Techniques for Creative Object Positioning](https://dl.acm.org/doi/10.1145/3462244.3479937)
- [Investigating Single-Handed Microgesture Scrolling Techniques](https://dl.acm.org/doi/10.1145/3772318.3791215) 

## Discussion
While we were already quite certain which paper we would like to replicate, we were unsure if it was possible, so we still considered other papers as well. In the following, the different papers will be explained more to show its strengths and what could have become problematic for us.

### Lip-Interact
- an interaction technique that enables silent voice commands
- uses smartphone frontcamera to capure the lip movement and recognizes the command with an end-to-end deep learning model
- implemented 44 different commands
- figured we would need to find a big dataset for different words or sentences and did not think we would find something like that - 
- their data was recorded with 22 participant and in chinese --> english words/ phrases are longer than chinese
- recording data or searching for a database that would suffice would have simply taken up too much time

### Pursuits
- user can walk up to a screen and immediately interact with the objects on it
- really interesting, might have been possible to implemet with OpenCV, we just were not quite sure about it
- also did not really know what kind of application to do to make it match the requirements of the assignment

### EyePointing
- a technique where gaze is used as a selector and pointing is used to trigger a task
- was ruled out quite quickly, because we figured actual eye-tracking would be necessary and we were not quite sure if these still existed and how long it would take to understand them
- also figured it would not be good for a demonstration if the gaze tracker would have to be calibrated

### GlassHands
- an interaction technique that widens the space one can use to interact with a smartphone by having the user wear sunglasses/ ski visiors/ or motorbike helmets
- using the reflection of phone and hands in the glasses, the user can then interact with the phone while moving the hands beside the phone
- seems like it would be a good scope for the two weeks we have
- already tested and recorded if we can see the reflection in the glasses we have at home and it looked like it could work quite well
- initial problematic: one of us does not have an android phone and we figured it would be hard to implement it for iOS

### Inclusive Voice Interaction
- the study tested different interaction options to use voice commands for creative work, such as the positioning of an image
- we were not quite sure how we could turn this into an actual application that could be demoed, but it also seemed quite interesting and would have been fun to implement
- simply copying the study might not have been enough for this assignment

### Microgesture Scrolling Techniques
- this study focused on how one could use microgestures to scroll a view
- they compared 3 different gestures to see which work the best for the given tasks
- we figured one could maybe do that with MediaPipe, but were not quite sure if all 3 gestures would actually work, because sometimes the fingers might be hidden and then it could be possible that it might not work
- we were also unsure if it makes sense to demo all 3 gestures, because not all of them might work perfectly and only implementing the one that worked best in their experiment might not fill out the scope, escpecially since the two tasks in the paper are also quite simple to implement as well 

## Choice of Paper
After much deliberation we decided to try and replicate GlassHands to the best of our abilities. We decided to do it as a web-application instead of doing it natively on Android, which would solve our problem of one of us not having an Android phone. The study itself, normally let the participants interact with all the normal apps one has on a smartphone such as maps, note app, the gallery and other apps, as we figured that would also break the scope and also did not want anyone to have to interact with our personal phones, we figured that a webpage with some small tasks that showcase the features would work much better for the demo.