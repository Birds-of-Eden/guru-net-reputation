"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Beam {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  length: number;
  width: number;
  color: string;
}

interface BackgroundBeamsWithCollisionProps {
  className?: string;
  beamOptions?: {
    count?: number;
    colors?: string[];
    minSpeed?: number;
    maxSpeed?: number;
    minLength?: number;
    maxLength?: number;
    minWidth?: number;
    maxWidth?: number;
  };
}

export const BackgroundBeamsWithCollision: React.FC<BackgroundBeamsWithCollisionProps> = ({
  className = "",
  beamOptions = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const beamsRef = useRef<Beam[]>([]);
  const animationRef = useRef<number>();

  const {
    count = 12,
    colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"],
    minSpeed = 0.5,
    maxSpeed = 2,
    minLength = 100,
    maxLength = 300,
    minWidth = 1,
    maxWidth = 3,
  } = beamOptions;

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Initialize beams
    beamsRef.current = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      vx: (Math.random() - 0.5) * (maxSpeed - minSpeed) + minSpeed,
      vy: (Math.random() - 0.5) * (maxSpeed - minSpeed) + minSpeed,
      angle: Math.random() * Math.PI * 2,
      length: Math.random() * (maxLength - minLength) + minLength,
      width: Math.random() * (maxWidth - minWidth) + minWidth,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const checkCollision = (beam1: Beam, beam2: Beam): boolean => {
      const dx = beam1.x - beam2.x;
      const dy = beam1.y - beam2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 50; // Collision threshold
    };

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      beamsRef.current.forEach((beam, index) => {
        // Update position
        beam.x += beam.vx;
        beam.y += beam.vy;
        beam.angle += 0.01;

        // Bounce off walls
        if (beam.x < 0 || beam.x > dimensions.width) {
          beam.vx *= -1;
        }
        if (beam.y < 0 || beam.y > dimensions.height) {
          beam.vy *= -1;
        }

        // Check collisions with other beams
        beamsRef.current.forEach((otherBeam, otherIndex) => {
          if (index !== otherIndex && checkCollision(beam, otherBeam)) {
            // Collision detected - create explosion effect
            const explosionRadius = 30;
            const gradient = ctx.createRadialGradient(
              beam.x,
              beam.y,
              0,
              beam.x,
              beam.y,
              explosionRadius
            );
            gradient.addColorStop(0, beam.color);
            gradient.addColorStop(1, "transparent");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(beam.x, beam.y, explosionRadius, 0, Math.PI * 2);
            ctx.fill();

            // Bounce beams
            const tempVx = beam.vx;
            const tempVy = beam.vy;
            beam.vx = otherBeam.vx;
            beam.vy = otherBeam.vy;
            otherBeam.vx = tempVx;
            otherBeam.vy = tempVy;
          }
        });

        // Draw beam
        ctx.save();
        ctx.translate(beam.x, beam.y);
        ctx.rotate(beam.angle);
        
        const gradient = ctx.createLinearGradient(
          -beam.length / 2,
          0,
          beam.length / 2,
          0
        );
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, beam.color);
        gradient.addColorStop(1, "transparent");

        ctx.strokeStyle = gradient;
        ctx.lineWidth = beam.width;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.moveTo(-beam.length / 2, 0);
        ctx.lineTo(beam.length / 2, 0);
        ctx.stroke();
        
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, count, colors, minSpeed, maxSpeed, minLength, maxLength, minWidth, maxWidth]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
};
