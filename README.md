# 🏋️ Real-Time AI-Based Exercise Evaluation Web App

This project is submitted as part of the technical assignment for the **Full Stack Intern** position at **Realfy Oasis Pvt. Ltd.**

---

## 🎯 Objective

A real-time browser-based fitness application that uses **MediaPipe Pose Landmarker** for pose detection and **Three.js** for 3D visual annotations. The app evaluates two exercises — **Squats** and **Push-Ups** — by identifying incorrect postures and providing immediate visual feedback. Additionally, the app includes a unique **image-based evaluation feature** that analyzes static images of squats and push-ups for form accuracy.

---

## 🚀 Live Demo

👉 [Live App Link](https://vasita27.github.io/Real_Time_AI_Powered_Exercise_Evaluation/)  
📹 [Demo Video Link](https://your-demo-video-link.com)  

---

## ✅ Core Features

### Real-Time Pose Detection

- Uses **MediaPipe Pose Landmarker (Web)** to capture and analyze real-time body posture via webcam.

### Exercise Selection Interface

- Buttons to choose:
  - `Start Squats`
  - `Start Push-Ups`
- Each button activates specific rule-based posture checks.

### Rule-Based Evaluation Logic

#### Squats:
- Checks for:
  - Back angle
  - Knee bending angle
  - Hip angle
  - Distance between the feet
- Compares them with the defined thresholds to determines the correctness of the squat
- Increments the rep counter if a complete squat is done

#### Push-Ups:
- Checks for:
  - Elbow angle
  - Sagging or arching of the back
- Compares them with the defined thresholds to determines the correctness of the squat
- Increments the rep counter if a complete pushup is done

### 🎨 Visual Feedback with Annotations

- **🟢 Green Keypoints**: Correct form
- **🔴 Red Keypoints and Lines**: Posture errors
- **Three.js Annotations**:
  - 3D labels and arrows appear on the 3D scene near to problematic joints if there is space for rendering.

### 🖼️ Unique Feature – Image-Based Posture Evaluation

- Upload images of users performing squats or push-ups
- App evaluates static pose based on joint coordinates
- Helpful for snapshot-based feedback

### 📱 Mobile Responsive

- The website has a mobile screen responsiveness
  
---

## 🧰 Tech Stack

| Area            | Tools Used                      |
|-----------------|---------------------------------|
| Pose Detection  | MediaPipe Pose Landmarker (Web) |
| Frontend        | HTML, CSS + Material UI, JavaScript|
| 3D Visualization| Three.js                        |
| Image Evaluation| Rule-Based JavaScript Logic     |
| Hosting         | GitHub Pages                    |

---

## 📄 License & Attribution

This project is made by referring the official documentation of media pipe which may include the example code snippets.

> © Google LLC. All rights reserved.  
> MediaPipe is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  
> Reference and adaptation comply with usage guidelines provided in the [MediaPipe Documentation](https://mediapipe.dev/).

---

## 📦 Deliverables Checklist

| Deliverable                | Status     |
|----------------------------|------------|
| GitHub Repository          | ✅          |
| Live Demo Link             | ✅          |
| Start Squats / Push-Ups UI | ✅          |
| Rule-Based Posture Logic   | ✅          |
| Red/Green Visual Feedback  | ✅          |
| 3D Annotations (Three.js)  | ✅          |
| Mobile-Responsive Layout   | ✅          |
| Demo Video (2–3 minutes)   | ✅          |
| Image Evaluation    | ✅ (⭐ Added Feature) |

---

## 📩 Submission Details

- Submitted on: *20/04/2025*

---

## 🙌 Acknowledgements

- Thanks to **Realfy Oasis** for this opportunity.
- Built using the powerful capabilities of **MediaPipe**, **Three.js**, and web technologies.

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

