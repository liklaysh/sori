import React from "react";
import { LinkMetadata } from "../../types/chat";
import { Globe, ShieldAlert, ExternalLink } from "lucide-react";

interface EmbedCardProps {
  data: LinkMetadata;
  compact?: boolean;
}

export const EmbedCard: React.FC<EmbedCardProps> = ({ data, compact }) => {
  const domain = new URL(data.url).hostname.replace("www.", "");

  if (data.isPrivate) {
    return (
      <div className="max-w-sm rounded-2xl p-4 bg-[#2c2d32] border-2 border-dashed border-[#3d3335] flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#3d2b2c] flex items-center justify-center text-sori-error shrink-0">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sori-error mb-0.5">Security Guard</p>
          <p className="text-xs font-bold text-[#a3a3a3] line-clamp-1">Internal Protocol Blocked</p>
        </div>
      </div>
    );
  }

  return (
    <a 
      href={data.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`
        group/embed flex flex-col bg-[#2c2d32] border border-[#3c3d42] rounded-2xl overflow-hidden shadow-2xl transition-all hover:border-[#484a7a] hover:bg-[#32343a]
        ${compact ? "max-w-xs" : "max-w-md w-full"}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Thumbnail Area */}
      {data.image && (
        <div className={`w-full overflow-hidden border-b border-[#3c3d42] relative bg-[#121212] ${compact ? "h-24" : "aspect-video"}`}>
          <img 
            src={data.image} 
            alt={data.title} 
            className="w-full h-full object-cover group-hover/embed:scale-105 transition-transform duration-700"
            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
          />
          <div className="absolute top-2 right-2 p-1.5 bg-[#121212] rounded-lg text-[#666666] group-hover/embed:text-sori-primary transition-colors opacity-0 group-hover/embed:opacity-100">
             <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#3c3d42] flex items-center justify-center overflow-hidden shrink-0 border border-[#4a4b51]">
            <img 
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
              className="w-full h-full"
              alt=""
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
            <Globe className="h-2 w-2 text-gray-400 absolute group-hover/embed:text-sori-primary transition-colors" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 group-hover/embed:text-sori-primary transition-colors">
            {data.siteName || domain}
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="text-xs font-black text-white line-clamp-2 leading-tight group-hover/embed:text-sori-primary transition-colors">
            {data.title || data.url}
          </h4>
          {data.description && (
            <p className="text-[10px] text-gray-400 font-medium line-clamp-3 leading-relaxed">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
};
