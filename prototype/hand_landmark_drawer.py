import numpy as np
import cv2

MARGIN = 10  # pixels
FONT_SIZE = 1
FONT_THICKNESS = 1
HANDEDNESS_TEXT_COLOR = (54, 205, 88)  # vibrant green, BGR order for cv2
LANDMARK_COLOR = (255, 255, 255)
CONNECTION_COLOR = (54, 205, 88)

# Standard 21-point hand landmark topology (thumb, index, middle, ring,
# pinky, palm) — same connection set MediaPipe's old solutions.hands
# module used to provide via HAND_CONNECTIONS.
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),        # index
    (5, 9), (9, 10), (10, 11), (11, 12),   # middle
    (9, 13), (13, 14), (14, 15), (15, 16), # ring
    (13, 17), (17, 18), (18, 19), (19, 20),# pinky
    (0, 17),                               # palm base
]


def draw_landmarks_on_image(rgb_image, detection_result):
    """Draws hand landmarks (and handedness label) on a copy of rgb_image.

    Args:
        rgb_image: numpy array (H, W, 3) in RGB order — e.g. mp_frame.numpy_view()
        detection_result: result returned by HandLandmarker.detect_for_video()

    Returns:
        A new numpy array with landmarks drawn on it.
    """
    hand_landmarks_list = detection_result.hand_landmarks
    handedness_list = detection_result.handedness
    annotated_image = np.copy(rgb_image)
    height, width = annotated_image.shape[:2]

    for idx in range(len(hand_landmarks_list)):
        hand_landmarks = hand_landmarks_list[idx]
        handedness = handedness_list[idx]

        # Convert normalized (0-1) landmark coords to pixel coords.
        points = [(int(lm.x * width), int(lm.y * height)) for lm in hand_landmarks]

        # Draw connections first so joints render on top.
        for start_idx, end_idx in HAND_CONNECTIONS:
            cv2.line(annotated_image, points[start_idx], points[end_idx], CONNECTION_COLOR, 2)

        # Draw landmark points.
        for point in points:
            cv2.circle(annotated_image, point, 4, LANDMARK_COLOR, -1)
            cv2.circle(annotated_image, point, 4, CONNECTION_COLOR, 1)

        # Label with handedness near the top-left of the hand's bounding box.
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        text_x = min(x_coords)
        text_y = min(y_coords) - MARGIN

        cv2.putText(
            annotated_image,
            f"{handedness[0].category_name}",
            (text_x, text_y),
            cv2.FONT_HERSHEY_DUPLEX,
            FONT_SIZE,
            HANDEDNESS_TEXT_COLOR,
            FONT_THICKNESS,
            cv2.LINE_AA
        )

    return annotated_image