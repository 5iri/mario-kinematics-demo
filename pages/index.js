import { useState, useEffect, useRef } from 'react';

export default function Home() {
  // Toggle between "FK" and "IK"
  const [mode, setMode] = useState('FK');

  // Link lengths (let user adjust)
  const [L1, setL1] = useState(100);
  const [L2, setL2] = useState(80);

  // FK mode: user inputs angles
  const [theta1, setTheta1] = useState(0);
  const [theta2, setTheta2] = useState(0);

  // IK mode: user inputs target
  const [targetX, setTargetX] = useState(100);
  const [targetY, setTargetY] = useState(50);

  // For display in FK mode: result (x, y)
  const [endX, setEndX] = useState(0);
  const [endY, setEndY] = useState(0);

  // For internal use in IK mode: computed angles
  const [ikTheta1, setIkTheta1] = useState(0);
  const [ikTheta2, setIkTheta2] = useState(0);

  // Canvas ref
  const canvasRef = useRef(null);

  // Helpers
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  // ============= FORWARD KINEMATICS =============
  // Given L1, L2, θ1, θ2 (in degrees), compute (x, y)
  function computeFK(L1, L2, theta1Deg, theta2Deg) {
    const t1 = toRad(theta1Deg);
    const t2 = toRad(theta2Deg);

    const x = L1 * Math.cos(t1) + L2 * Math.cos(t1 + t2);
    const y = L1 * Math.sin(t1) + L2 * Math.sin(t1 + t2);
    return { x, y };
  }

  // ============= INVERSE KINEMATICS =============
  // Solve for "elbow up" solution
  function computeIK(L1, L2, x, y) {
    // Distance from origin to target
    const dist = Math.sqrt(x * x + y * y);

    // Check if target is reachable
    if (dist > L1 + L2 || dist < Math.abs(L1 - L2)) {
      // Target is unreachable; return default angles (could be improved)
      return { theta1Deg: 0, theta2Deg: 0 };
    }

    // Compute theta2 using cosine law: cos(θ2) = (x² + y² - L1² - L2²) / (2 * L1 * L2)
    let cosTheta2 = (x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    cosTheta2 = Math.max(-1, Math.min(1, cosTheta2)); // Clamp for floating-point safety
    const theta2Rad = Math.acos(cosTheta2); // "Elbow up" solution
    const theta2Deg = toDeg(theta2Rad);

    // Compute theta1
    const phi = Math.acos((L1 * L1 + x * x + y * y - L2 * L2) / (2 * L1 * dist));
    const alpha = Math.atan2(y, x);
    const theta1Rad = alpha - phi; // "Elbow up" configuration
    const theta1Deg = toDeg(theta1Rad);

    return { theta1Deg, theta2Deg };
  }

  // Whenever angles or link lengths change in FK mode, compute end-effector
  useEffect(() => {
    if (mode === 'FK') {
      const { x, y } = computeFK(L1, L2, theta1, theta2);
      setEndX(x.toFixed(2));
      setEndY(y.toFixed(2));
    }
  }, [mode, L1, L2, theta1, theta2]);

  // Whenever target or link lengths change in IK mode, compute angles
  useEffect(() => {
    if (mode === 'IK') {
      const { theta1Deg, theta2Deg } = computeIK(L1, L2, targetX, targetY);
      setIkTheta1(theta1Deg);
      setIkTheta2(theta2Deg);
    }
  }, [mode, L1, L2, targetX, targetY]);

  // We always re-draw the arm whenever something changes
  useEffect(() => {
    drawArm();
  }, [mode, L1, L2, theta1, theta2, targetX, targetY, ikTheta1, ikTheta2]);

  function drawArm() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const originX = canvas.width / 2;
    const originY = canvas.height / 2;

    // Determine angles we use for drawing:
    // - In FK, use the user-input angles (theta1, theta2).
    // - In IK, use the computed angles (ikTheta1, ikTheta2).
    let drawT1Deg = mode === 'FK' ? theta1 : ikTheta1;
    let drawT2Deg = mode === 'FK' ? theta2 : ikTheta2;

    // Convert to radians
    const t1 = toRad(drawT1Deg);
    const t2 = toRad(drawT2Deg);

    // Joint1 in canvas coords
    const joint1X = originX + L1 * Math.cos(t1);
    const joint1Y = originY - L1 * Math.sin(t1);

    // Joint2 in canvas coords
    const joint2X = joint1X + L2 * Math.cos(t1 + t2);
    const joint2Y = joint1Y - L2 * Math.sin(t1 + t2);

    // ============= DRAW THINGS =============
    // 1) If IK mode, show the red target
    if (mode === 'IK') {
      const targX = originX + targetX;     // user target x in "math" -> canvas
      const targY = originY - targetY;     // user target y in "math" -> canvas
      ctx.beginPath();
      ctx.arc(targX, targY, 5, 0, 2*Math.PI);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.closePath();
    }

    // 2) Draw the links
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(joint1X, joint1Y);
    ctx.lineTo(joint2X, joint2Y);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.closePath();

    // 3) Draw the joints as circles
    [ [originX, originY], [joint1X, joint1Y], [joint2X, joint2Y] ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2*Math.PI);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();
      ctx.closePath();
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center p-4 text-white">
      <h1 className="text-3xl font-bold my-4">2-Link Arm Demo (FK & IK)</h1>

      {/* Mode Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('FK')}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            mode === 'FK' ? 'bg-white text-indigo-600' : 'bg-indigo-400 hover:bg-indigo-500'
          }`}
        >
          Forward Kinematics
        </button>
        <button
          onClick={() => setMode('IK')}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            mode === 'IK' ? 'bg-white text-indigo-600' : 'bg-indigo-400 hover:bg-indigo-500'
          }`}
        >
          Inverse Kinematics
        </button>
      </div>

      {/* Card with Canvas + Controls */}
      <div className="bg-white text-gray-800 rounded-lg p-6 shadow-lg max-w-2xl w-full">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="border border-gray-300 w-full mb-6"
        />

        {/* Shared: Link Lengths */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-1">Link 1 (L1)</label>
            <input
              type="number"
              value={L1}
              onChange={(e) => setL1(Number(e.target.value))}
              className="border rounded px-2 py-1 w-24"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Link 2 (L2)</label>
            <input
              type="number"
              value={L2}
              onChange={(e) => setL2(Number(e.target.value))}
              className="border rounded px-2 py-1 w-24"
            />
          </div>
        </div>

        {/* FK Mode */}
        {mode === 'FK' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">θ1 (deg)</label>
                <input
                  type="number"
                  value={theta1}
                  onChange={(e) => setTheta1(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">θ2 (deg)</label>
                <input
                  type="number"
                  value={theta2}
                  onChange={(e) => setTheta2(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
            </div>
            <p>
              <strong>End-Effector:</strong> ( {endX}, {endY} )
            </p>
          </div>
        )}

        {/* IK Mode */}
        {mode === 'IK' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Target X</label>
                <input
                  type="number"
                  value={targetX}
                  onChange={(e) => setTargetX(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Target Y</label>
                <input
                  type="number"
                  value={targetY}
                  onChange={(e) => setTargetY(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                />
              </div>
            </div>
            <p>
              <strong>Computed Angles:</strong> θ1 = {ikTheta1.toFixed(2)}°, θ2 = {ikTheta2.toFixed(2)}°
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
