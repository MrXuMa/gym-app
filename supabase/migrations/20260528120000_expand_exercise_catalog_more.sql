-- Further expand global exercise catalog (idempotent — skips names that already exist).
-- Relies on exercises_name_lower_unique index created in 20260526160000.

INSERT INTO public.exercises (name, target_muscle, description)
SELECT v.name, v.target_muscle, v.description
FROM (
  VALUES
    -- Back
    ('Chin-Up', 'Back', 'Underhand-grip pull-up emphasizing lats and biceps.'),
    ('Cable Pullover', 'Back', 'Standing cable pullover for lat isolation.'),
    ('Dumbbell Pullover', 'Back', 'Lying dumbbell pullover for lats and serratus.'),
    ('Kroc Row', 'Back', 'Heavy high-rep one-arm dumbbell row.'),
    ('Landmine Row', 'Back', 'Bent-over row using a landmine attachment.'),
    ('Machine High Row', 'Back', 'Plate-loaded high row machine.'),
    ('Renegade Row', 'Back', 'Plank position alternating dumbbell row.'),
    ('Reverse-Grip Lat Pulldown', 'Back', 'Lat pulldown with supinated grip.'),
    ('Seal Row', 'Back', 'Chest-supported barbell row on a bench.'),
    ('Single-Arm Lat Pulldown', 'Back', 'Unilateral cable lat pulldown.'),
    ('Yates Row', 'Back', 'Underhand grip barbell row in a more upright torso position.'),

    -- Biceps
    ('Bayesian Cable Curl', 'Biceps', 'Cable curl with cable behind the body for long-head stretch.'),
    ('Cable Hammer Curl', 'Biceps', 'Hammer curl using a rope attachment on a cable.'),
    ('Cross-Body Hammer Curl', 'Biceps', 'Hammer curl across the chest for brachialis emphasis.'),
    ('Drag Curl', 'Biceps', 'Barbell curl dragging the bar up the torso.'),
    ('Dumbbell Curl', 'Biceps', 'Standard standing dumbbell biceps curl.'),
    ('Machine Preacher Curl', 'Biceps', 'Preacher curl on a plate-loaded or selectorized machine.'),
    ('Reverse Curl', 'Biceps', 'Overhand curl emphasizing brachialis and forearms.'),
    ('Zottman Curl', 'Biceps', 'Curl up supinated, rotate to pronated, lower down.'),

    -- Calves
    ('Hack Squat Calf Raise', 'Calves', 'Calf raise performed on a hack squat machine.'),
    ('Jump Rope', 'Calves', 'Skipping rope for calf endurance and conditioning.'),
    ('Smith Machine Calf Raise', 'Calves', 'Standing calf raise on a Smith machine.'),
    ('Tibialis Raise', 'Calves', 'Anterior tibialis dorsiflexion raise.'),

    -- Chest
    ('Deficit Push-Up', 'Chest', 'Push-up with hands elevated on handles for greater range.'),
    ('Decline Dumbbell Press', 'Chest', 'Decline bench dumbbell press.'),
    ('Hex Press', 'Chest', 'Dumbbells pressed together throughout (squeeze press).'),
    ('Incline Cable Fly', 'Chest', 'Incline bench cable fly.'),
    ('Incline Machine Press', 'Chest', 'Plate-loaded or selectorized incline chest press.'),
    ('Iso-Lateral Chest Press', 'Chest', 'Plate-loaded independent-arm chest press machine.'),
    ('Plyometric Push-Up', 'Chest', 'Explosive push-up with hands leaving the floor.'),
    ('Single-Arm Dumbbell Bench Press', 'Chest', 'Unilateral dumbbell bench press for core demand.'),
    ('Smith Machine Incline Press', 'Chest', 'Incline press on a Smith machine.'),
    ('Svend Press', 'Chest', 'Standing plate squeeze press in front of the chest.'),

    -- Core
    ('Bird Dog', 'Core', 'Quadruped opposite arm/leg reach for anti-rotation.'),
    ('Decline Sit-Up', 'Core', 'Weighted or bodyweight sit-up on a decline bench.'),
    ('Dragon Flag', 'Core', 'Advanced full-body anti-extension hold along a bench.'),
    ('GHD Sit-Up', 'Core', 'Sit-up performed on a glute-ham developer.'),
    ('Hollow Hold', 'Core', 'Supine isometric hollow body position.'),
    ('L-Sit', 'Core', 'Static parallel-bar hold with legs extended.'),
    ('Mountain Climber', 'Core', 'Plank with alternating knee drive.'),
    ('Reverse Crunch', 'Core', 'Hip-lift crunch driving knees toward chest.'),
    ('Toes-to-Bar', 'Core', 'Hanging full leg raise touching feet to the bar.'),
    ('V-Up', 'Core', 'Simultaneous arm and leg raise into a V position.'),
    ('Windshield Wiper', 'Core', 'Supine or hanging rotational leg sweep.'),

    -- Glutes
    ('45-Degree Hyperextension', 'Glutes', 'Hip hinge extension on a 45-degree bench.'),
    ('Banded Hip Thrust', 'Glutes', 'Hip thrust with band around knees for glute med activation.'),
    ('B-Stance Hip Thrust', 'Glutes', 'Hip thrust with one foot kickstanded behind the other.'),
    ('Curtsy Lunge', 'Glutes', 'Reverse cross-body lunge emphasizing glute medius.'),
    ('Glute Kickback Machine', 'Glutes', 'Standing glute kickback on a machine.'),
    ('Monster Walk', 'Glutes', 'Banded forward and lateral walking for glute medius.'),
    ('Reverse Hyperextension', 'Glutes', 'Prone hip extension on a reverse hyper machine.'),
    ('Single-Leg Glute Bridge', 'Glutes', 'Floor bridge performed on one leg.'),

    -- Grip / Traps
    ('Behind-the-Back Shrug', 'Grip / Traps', 'Barbell shrug held behind the body (Haney shrug).'),
    ('Dead Hang', 'Grip / Traps', 'Passive hang from a bar for grip endurance.'),
    ('Plate Pinch', 'Grip / Traps', 'Pinch-gripping two plates together for timed holds.'),
    ('Reverse Wrist Curl', 'Grip / Traps', 'Forearm extensor curl.'),
    ('Snatch-Grip Shrug', 'Grip / Traps', 'Wide-grip barbell shrug from the hang.'),
    ('Towel Pull-Up', 'Grip / Traps', 'Pull-up gripping towels draped over the bar.'),
    ('Trap Bar Shrug', 'Grip / Traps', 'Heavy shrug using a trap (hex) bar.'),
    ('Wrist Roller', 'Grip / Traps', 'Rolling a weighted rope up and down a handle.'),

    -- Hamstrings
    ('Banded Good Morning', 'Hamstrings', 'Hip hinge with band looped under the feet and over the back.'),
    ('Kettlebell Swing', 'Hamstrings', 'Hip-hinge powered kettlebell swing.'),
    ('Lying Leg Curl', 'Hamstrings', 'Prone machine hamstring curl.'),
    ('Seated Leg Curl', 'Hamstrings', 'Seated machine hamstring curl.'),
    ('Single-Leg Leg Curl', 'Hamstrings', 'Unilateral machine hamstring curl.'),

    -- Legs (compound / Olympic / variant deadlifts)
    ('Block Pull', 'Legs', 'Partial deadlift from blocks for lockout strength.'),
    ('Clean and Jerk', 'Legs', 'Olympic lift: clean followed by overhead jerk.'),
    ('Deficit Deadlift', 'Legs', 'Conventional deadlift standing on a low platform.'),
    ('Pause Deadlift', 'Legs', 'Deadlift with a pause below the knee.'),
    ('Power Clean', 'Legs', 'Explosive pull catching the bar in a partial squat.'),
    ('Snatch', 'Legs', 'Olympic snatch lift, ground to overhead in one motion.'),
    ('Snatch-Grip Deadlift', 'Legs', 'Deadlift performed with a wide snatch grip.'),

    -- Quads
    ('Air Squat', 'Quads', 'Bodyweight squat.'),
    ('Box Step Down', 'Quads', 'Slow eccentric step-down off a box.'),
    ('Cyclist Squat', 'Quads', 'Heel-elevated squat emphasizing quads.'),
    ('Jumping Squat', 'Quads', 'Bodyweight squat with explosive jump.'),
    ('Lateral Lunge', 'Quads', 'Side-stepping lunge for frontal-plane strength.'),
    ('Pause Squat', 'Quads', 'Back squat with a pause in the bottom position.'),
    ('Pendulum Squat', 'Quads', 'Machine pendulum squat for quad isolation.'),
    ('Pin Squat', 'Quads', 'Squat to safety pins for a hard stop in the hole.'),
    ('Sissy Squat', 'Quads', 'Knees-forward quad-isolation squat.'),
    ('Spanish Squat', 'Quads', 'Knee-friendly squat using a band looped behind the knees.'),
    ('Tempo Squat', 'Quads', 'Back squat with prescribed eccentric and pause tempo.'),

    -- Rear Delts
    ('Bent-Over Reverse Fly', 'Rear Delts', 'Free-weight bent-over reverse fly.'),
    ('Prone T Raise', 'Rear Delts', 'Prone bench horizontal T raise for rear delts and traps.'),
    ('Prone Y Raise', 'Rear Delts', 'Prone bench Y raise for lower traps and rear delts.'),
    ('Reverse Cable Fly', 'Rear Delts', 'Standing cross-cable reverse fly.'),

    -- Shoulders
    ('Behind-the-Neck Press', 'Shoulders', 'Barbell overhead press lowered behind the neck.'),
    ('Bottoms-Up Kettlebell Press', 'Shoulders', 'Kettlebell pressed with bell inverted for stability work.'),
    ('Bradford Press', 'Shoulders', 'Alternating front and back overhead press partials.'),
    ('Cable Front Raise', 'Shoulders', 'Anterior delt raise from a low cable.'),
    ('Half-Kneeling Press', 'Shoulders', 'Single-arm overhead press from a half-kneeling stance.'),
    ('Landmine Press', 'Shoulders', 'Single-arm angled press using a landmine attachment.'),
    ('Plate Front Raise', 'Shoulders', 'Front raise with both hands holding one plate.'),
    ('Single-Arm Dumbbell Press', 'Shoulders', 'Standing or seated unilateral dumbbell press.'),
    ('Y Raise', 'Shoulders', 'Standing or incline Y raise for scapular upward rotation.'),
    ('Z Press', 'Shoulders', 'Seated floor overhead press with legs extended.'),

    -- Triceps
    ('Bench Dip', 'Triceps', 'Dip with hands on a bench and feet on the floor or another bench.'),
    ('Cable Crossbody Extension', 'Triceps', 'Single-arm cable triceps extension across the body.'),
    ('California Press', 'Triceps', 'Hybrid between close-grip bench press and skull crusher.'),
    ('Diamond Push-Up', 'Triceps', 'Push-up with hands forming a diamond under the chest.'),
    ('French Press', 'Triceps', 'Seated barbell overhead triceps extension.'),
    ('Lying Dumbbell Tricep Extension', 'Triceps', 'Supine dumbbell triceps extension toward the forehead.'),
    ('Reverse-Grip Tricep Pushdown', 'Triceps', 'Cable pushdown with supinated grip.'),
    ('Single-Arm Tricep Pushdown', 'Triceps', 'Unilateral cable pushdown with D-handle.'),
    ('Tate Press', 'Triceps', 'Lying dumbbell elbow-out triceps press.'),
    ('Tricep Dip Machine', 'Triceps', 'Assisted or weighted machine triceps dip.')
) AS v(name, target_muscle, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.exercises e
  WHERE lower(trim(e.name)) = lower(trim(v.name))
);
