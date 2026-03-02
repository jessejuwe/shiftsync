"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MapPin, Plus, X } from "lucide-react";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: { id: string; name: string }[];
  certifications: {
    id: string;
    locationId: string;
    locationName: string;
    expiresAt: string;
  }[];
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
}

export interface Location {
  id: string;
  name: string;
}

export interface StaffCardProps {
  staff: StaffMember;
  skills: Skill[];
  locations: Location[];
  onAddSkill: (skillId: string) => void;
  onRemoveSkill: (skillId: string) => void;
  onCertify: (locationId: string) => void;
  onDecertify: (certificationId: string) => void;
  isAddingSkill: boolean;
  isRemovingSkill: boolean;
  isCertifying: boolean;
  isDecertifying: boolean;
}

export function StaffCard({
  staff,
  skills,
  locations,
  onAddSkill,
  onRemoveSkill,
  onCertify,
  onDecertify,
  isAddingSkill,
  isRemovingSkill,
  isCertifying,
  isDecertifying,
}: StaffCardProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const availableSkills = skills.filter(
    (sk) => !staff.skills.some((us) => us.id === sk.id)
  );
  const availableLocations = locations.filter(
    (loc) =>
      !staff.certifications.some(
        (c) =>
          c.locationId === loc.id && new Date(c.expiresAt) > new Date()
      )
  );

  const handleAddSkill = () => {
    if (selectedSkillId) {
      onAddSkill(selectedSkillId);
      setSelectedSkillId("");
    }
  };

  const handleCertify = () => {
    if (selectedLocationId) {
      onCertify(selectedLocationId);
      setSelectedLocationId("");
    }
  };

  const isCertExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{staff.name}</CardTitle>
            <p className="text-muted-foreground text-sm">{staff.email}</p>
            {staff.role === "MANAGER" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="mt-1">
                    Manager
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Can manage staff and schedules</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {staff.skills.map((sk) => (
              <Badge key={sk.id} variant="secondary" className="gap-1 pr-1">
                {sk.name}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-4 rounded-full hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => onRemoveSkill(sk.id)}
                      disabled={isRemovingSkill}
                      aria-label={`Remove ${sk.name}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove {sk.name} skill</TooltipContent>
                </Tooltip>
              </Badge>
            ))}
            {availableSkills.length > 0 && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Select
                        value={selectedSkillId}
                        onValueChange={setSelectedSkillId}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue placeholder="Add skill" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSkills.map((sk) => (
                            <SelectItem key={sk.id} value={sk.id}>
                              {sk.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Add a skill to determine shift eligibility
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleAddSkill}
                      disabled={!selectedSkillId || isAddingSkill}
                      aria-label="Add skill"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add selected skill</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground flex cursor-help items-center gap-1 text-xs font-medium">
                <MapPin className="size-3" />
                Locations
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Locations this staff member is certified to work at
            </TooltipContent>
          </Tooltip>
          {staff.certifications.map((c) => (
            <Badge
              key={c.id}
              variant={isCertExpired(c.expiresAt) ? "outline" : "secondary"}
              className="gap-1 pr-1"
            >
              {c.locationName}
              {isCertExpired(c.expiresAt) && (
                <span className="text-muted-foreground text-xs">(expired)</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 rounded-full hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => onDecertify(c.id)}
                    disabled={isDecertifying}
                    aria-label={`De-certify from ${c.locationName}`}
                  >
                    <X className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  De-certify from {c.locationName}
                </TooltipContent>
              </Tooltip>
            </Badge>
          ))}
          {availableLocations.length > 0 && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Select
                      value={selectedLocationId}
                      onValueChange={setSelectedLocationId}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Certify at location" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Select a location to certify this staff at
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCertify}
                    disabled={!selectedLocationId || isCertifying}
                  >
                    Certify
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Certify at selected location (valid 1 year)
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </CardHeader>
      {staff.skills.length === 0 &&
        availableSkills.length === 0 &&
        staff.certifications.length === 0 &&
        availableLocations.length === 0 && (
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-sm">
              No skills or certifications. Add skills and certify at locations.
            </p>
          </CardContent>
        )}
    </Card>
  );
}
